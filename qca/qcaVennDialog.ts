export interface QcaTruthTableEntry {
    name?: string;
    value?: string;
    text?: string;
    options?: {
        conditions?: unknown;
        [key: string]: unknown;
    };
    id?: unknown;
    ids?: unknown;
    out?: unknown;
    cases?: unknown;
}


export interface QcaVennRenderPayload {
    conditions: string[];
    ids: string[];
    out: string[];
    cases: string[];
    showCustom: boolean;
    customText: string;
}


export interface QcaVennDialogState {
    truthTableNames: string[];
    selectedTruthTable: string;
    renderPayload: QcaVennRenderPayload;
}


export interface QcaVennDialogRequest {
    truthTables: QcaTruthTableEntry[];
    truthTableName?: unknown;
    selectedTruthTable?: unknown;
    previousSelection?: unknown;
    customEnabled?: unknown;
    showCustom?: unknown;
    customText?: unknown;
    conditions?: unknown;
}


const asText = function(value: unknown): string {
    return String(value ?? "").trim();
};


const asStringArray = function(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.map((entry) => {
        return String(entry ?? "").trim();
    });
};


export const normalizeQcaConditionList = function(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.map((entry) => {
            return asText(entry);
        }).filter(Boolean);
    }

    const text = asText(value);
    if (!text) {
        return [];
    }

    return text.split(",").map((entry) => {
        return entry.trim();
    }).filter(Boolean);
};


const readTruthTableName = function(entry: QcaTruthTableEntry): string {
    return asText(entry.name ?? entry.value ?? entry.text);
};


export const listQcaTruthTableNames = function(truthTables: QcaTruthTableEntry[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];

    truthTables.forEach((entry) => {
        const name = readTruthTableName(entry);
        if (!name || seen.has(name)) {
            return;
        }

        seen.add(name);
        out.push(name);
    });

    return out;
};


export const findQcaTruthTable = function(
    truthTables: QcaTruthTableEntry[],
    truthTableName: string
): QcaTruthTableEntry | null {
    if (!truthTableName) {
        return null;
    }

    return truthTables.find((entry) => {
        return readTruthTableName(entry) === truthTableName;
    }) ?? null;
};


export const createEmptyQcaVennPayload = function(): QcaVennRenderPayload {
    return {
        conditions: [],
        ids: [],
        out: [],
        cases: [],
        showCustom: false,
        customText: ""
    };
};


export const buildQcaVennRenderPayload = function(request: QcaVennDialogRequest): QcaVennRenderPayload {
    const truthTableName = asText(request.truthTableName ?? request.selectedTruthTable);
    const truthTable = findQcaTruthTable(request.truthTables, truthTableName);

    if (!truthTable) {
        return createEmptyQcaVennPayload();
    }

    return {
        conditions: normalizeQcaConditionList(request.conditions ?? truthTable.options?.conditions),
        ids: asStringArray(truthTable.id ?? truthTable.ids),
        out: asStringArray(truthTable.out),
        cases: asStringArray(truthTable.cases),
        showCustom: request.showCustom === true || request.customEnabled === true,
        customText: asText(request.customText)
    };
};


export const createQcaVennDialogState = function(request: QcaVennDialogRequest): QcaVennDialogState {
    const truthTableNames = listQcaTruthTableNames(request.truthTables);
    const requestedSelection = asText(request.truthTableName ?? request.selectedTruthTable);
    const previousSelection = asText(request.previousSelection);
    let selectedTruthTable = "";

    if (requestedSelection && truthTableNames.includes(requestedSelection)) {
        selectedTruthTable = requestedSelection;
    } else if (previousSelection && truthTableNames.includes(previousSelection)) {
        selectedTruthTable = previousSelection;
    } else if (truthTableNames.length === 1) {
        selectedTruthTable = truthTableNames[0];
    } else if (truthTableNames.length > 1) {
        selectedTruthTable = truthTableNames[truthTableNames.length - 1];
    }

    return {
        truthTableNames,
        selectedTruthTable,
        renderPayload: buildQcaVennRenderPayload({
            ...request,
            selectedTruthTable
        })
    };
};
