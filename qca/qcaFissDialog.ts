export interface QcaFissCandidate {
    configuration: string;
    terms: string[];
}


export interface QcaFissFit {
    consistency: number | null;
    rawCoverage: number | null;
    uniqueCoverage: number | null;
}


export interface QcaFissRenderPayload {
    kind: "fiss";
    title: string;
    conditions: string[];
    configurations: string[];
    expressions: string[];
    values: string[][];
    roles: string[][];
    fit: QcaFissFit[];
    solutionFit: {
        consistency: number | null;
        coverage: number | null;
    };
    legend: boolean;
    message: string;
}


export interface QcaFissDialogState {
    solutionNames: string[];
    selectedSolution: string;
    branches: string[];
    selectedBranch: string;
    models: string[];
    selectedModel: string;
    ambiguities: QcaFissCandidate[];
    selectedAmbiguity: string;
    coreCandidates: string[];
    selectedCoreTerm: string;
    coreSelections: Record<string, string>;
    title: string;
    legend: boolean;
    useLabels: boolean;
    command: string;
    message: string;
    renderPayload: QcaFissRenderPayload;
}


const asRecord = function(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
};


const asText = function(value: unknown): string {
    return String(value ?? "").trim();
};


const asStrings = function(value: unknown): string[] {
    return Array.isArray(value) ? value.map(asText).filter(Boolean) : [];
};


const asRows = function(value: unknown): string[][] {
    return Array.isArray(value) ? value.map((row) => {
        return Array.isArray(row) ? row.map((entry) => String(entry ?? "")) : [];
    }) : [];
};


const asNumber = function(value: unknown): number | null {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const number = Number(value);

    return Number.isFinite(number) ? number : null;
};


export const createEmptyQcaFissPayload = function(message = ""): QcaFissRenderPayload {
    return {
        kind: "fiss",
        title: "",
        conditions: [],
        configurations: [],
        expressions: [],
        values: [],
        roles: [],
        fit: [],
        solutionFit: {
            consistency: null,
            coverage: null
        },
        legend: false,
        message
    };
};


export const normalizeQcaFissDialogState = function(value: unknown): QcaFissDialogState {
    const source = asRecord(value);
    const selections = asRecord(source.coreSelections);
    const render = asRecord(source.renderPayload);
    const solutionFit = asRecord(render.solutionFit);
    const ambiguities = Array.isArray(source.ambiguities)
        ? source.ambiguities.map((entry) => {
            const item = asRecord(entry);

            return {
                configuration: asText(item.configuration),
                terms: asStrings(item.terms)
            };
        }).filter((item) => {
            return Boolean(item.configuration && item.terms.length);
        })
        : [];
    const fit = Array.isArray(render.fit) ? render.fit.map((entry) => {
        const item = asRecord(entry);

        return {
            consistency: asNumber(item.consistency),
            rawCoverage: asNumber(item.rawCoverage),
            uniqueCoverage: asNumber(item.uniqueCoverage)
        };
    }) : [];
    const coreSelections: Record<string, string> = {};

    Object.entries(selections).forEach(([configuration, term]) => {
        const name = asText(configuration);
        const selected = asText(term);

        if (name && selected) {
            coreSelections[name] = selected;
        }
    });

    const payload: QcaFissRenderPayload = {
        kind: "fiss",
        title: asText(render.title),
        conditions: asStrings(render.conditions),
        configurations: asStrings(render.configurations),
        expressions: asStrings(render.expressions),
        values: asRows(render.values),
        roles: asRows(render.roles),
        fit,
        solutionFit: {
            consistency: asNumber(solutionFit.consistency),
            coverage: asNumber(solutionFit.coverage)
        },
        legend: render.legend === true,
        message: asText(render.message)
    };

    return {
        solutionNames: asStrings(source.solutionNames),
        selectedSolution: asText(source.selectedSolution),
        branches: asStrings(source.branches),
        selectedBranch: asText(source.selectedBranch),
        models: asStrings(source.models),
        selectedModel: asText(source.selectedModel),
        ambiguities,
        selectedAmbiguity: asText(source.selectedAmbiguity),
        coreCandidates: asStrings(source.coreCandidates),
        selectedCoreTerm: asText(source.selectedCoreTerm),
        coreSelections,
        title: asText(source.title),
        legend: source.legend === true,
        useLabels: source.useLabels === true,
        command: asText(source.command),
        message: asText(source.message),
        renderPayload: payload.conditions.length || !payload.message
            ? payload
            : createEmptyQcaFissPayload(payload.message)
    };
};
