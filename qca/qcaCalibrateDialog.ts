export interface QcaCalibrateDialogState {
    selectedDataset?: unknown;
    selectedVariable?: unknown;
    newConditionName?: unknown;
    useNewCondition?: unknown;
    type?: unknown;
    crisp?: unknown;
    bell?: unknown;
    increasing?: unknown;
    thresholdCount?: unknown;
    thresholdValues?: unknown;
    findThresholds?: unknown;
    logistic?: unknown;
    ecdf?: unknown;
    jitter?: unknown;
    idm?: unknown;
    above?: unknown;
    below?: unknown;
}


export interface QcaCalibrateDialogControls {
    datasetContainer: string;
    variableContainer: string;
    typeCrisp: string;
    typeFuzzy: string;
    shapeBell: string;
    shapeS: string;
    directionInc: string;
    directionDec: string;
    thresholdCount: string;
    thresholdInputs: string[];
    thresholdLabels: string[];
    findThresholdsCheckbox: string;
    logisticCheckbox: string;
    ecdfCheckbox: string;
    jitterCheckbox: string;
    newConditionCheckbox: string;
    newConditionInput: string;
    idmInput: string;
    aboveInput: string;
    belowInput: string;
    plot: string;
    shapeLabel: string;
    shapeSLabel: string;
    shapeBellLabel: string;
    directionLabel: string;
    directionIncLabel: string;
    directionDecLabel: string;
    thresholdCountLabel: string;
    findThresholdsLabel: string;
    jitterLabel: string;
    logisticLabel: string;
    ecdfLabel: string;
    idmLabel: string;
    shapeFormLabel: string;
    aboveLabel: string;
    belowLabel: string;
}


export interface QcaCalibrateControlSnapshotEntry {
    value?: unknown;
    selected?: string[];
    checked?: boolean;
}


export type QcaCalibrateControlSnapshot = Record<string, QcaCalibrateControlSnapshotEntry>;


export interface QcaCalibrateDialogViewState {
    controls: QcaCalibrateDialogControls;
    state: QcaCalibrateDialogState;
    thresholdNames: string[];
    visibleThresholdCount: number;
    thresholdValues: string[];
    previewPayload: unknown;
    validation: QcaCalibrateValidationResult;
}


export interface QcaCalibrateValidationResult {
    status: "ready" | "invalid";
    command: string;
    errors: string[];
}


const asText = function(value: unknown): string {
    return String(value ?? "").trim();
};


const asNumber = function(value: unknown): number {
    const out = Number(value);
    return Number.isFinite(out) ? out : NaN;
};


const asBoolean = function(value: unknown): boolean {
    return value === true || value === "true" || value === 1 || value === "1";
};


const asThresholdValues = function(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.map((entry) => {
        return asText(entry);
    });
};


const asStringArray = function(value: unknown): string[] {
    return Array.isArray(value) ? value.map((entry) => {
        return asText(entry);
    }).filter(Boolean) : [];
};


const asRecord = function(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
};


const readControl = function(
    snapshot: QcaCalibrateControlSnapshot,
    name: string
): QcaCalibrateControlSnapshotEntry {
    return snapshot[name] || {};
};


const readControlValue = function(snapshot: QcaCalibrateControlSnapshot, name: string): unknown {
    return readControl(snapshot, name).value;
};


const readControlSelected = function(snapshot: QcaCalibrateControlSnapshot, name: string): string {
    return asStringArray(readControl(snapshot, name).selected)[0] || "";
};


const readControlChecked = function(snapshot: QcaCalibrateControlSnapshot, name: string): boolean {
    return readControl(snapshot, name).checked === true;
};


const readControls = function(parameters: Record<string, unknown>): QcaCalibrateDialogControls {
    return {
        datasetContainer: asText(parameters.datasetContainer),
        variableContainer: asText(parameters.variableContainer),
        typeCrisp: asText(parameters.typeCrisp),
        typeFuzzy: asText(parameters.typeFuzzy),
        shapeBell: asText(parameters.shapeBell),
        shapeS: asText(parameters.shapeS),
        directionInc: asText(parameters.directionInc),
        directionDec: asText(parameters.directionDec),
        thresholdCount: asText(parameters.thresholdCount),
        thresholdInputs: asStringArray(parameters.thresholdInputs),
        thresholdLabels: asStringArray(parameters.thresholdLabels),
        findThresholdsCheckbox: asText(parameters.findThresholdsCheckbox),
        logisticCheckbox: asText(parameters.logisticCheckbox),
        ecdfCheckbox: asText(parameters.ecdfCheckbox),
        jitterCheckbox: asText(parameters.jitterCheckbox),
        newConditionCheckbox: asText(parameters.newConditionCheckbox),
        newConditionInput: asText(parameters.newConditionInput),
        idmInput: asText(parameters.idmInput),
        aboveInput: asText(parameters.aboveInput),
        belowInput: asText(parameters.belowInput),
        plot: asText(parameters.plot),
        shapeLabel: asText(parameters.shapeLabel),
        shapeSLabel: asText(parameters.shapeSLabel),
        shapeBellLabel: asText(parameters.shapeBellLabel),
        directionLabel: asText(parameters.directionLabel),
        directionIncLabel: asText(parameters.directionIncLabel),
        directionDecLabel: asText(parameters.directionDecLabel),
        thresholdCountLabel: asText(parameters.thresholdCountLabel),
        findThresholdsLabel: asText(parameters.findThresholdsLabel),
        jitterLabel: asText(parameters.jitterLabel),
        logisticLabel: asText(parameters.logisticLabel),
        ecdfLabel: asText(parameters.ecdfLabel),
        idmLabel: asText(parameters.idmLabel),
        shapeFormLabel: asText(parameters.shapeFormLabel),
        aboveLabel: asText(parameters.aboveLabel),
        belowLabel: asText(parameters.belowLabel)
    };
};


const readSnapshot = function(parameters: Record<string, unknown>): QcaCalibrateControlSnapshot {
    const snapshot = asRecord(parameters.__controlSnapshot);
    const out: QcaCalibrateControlSnapshot = {};

    Object.keys(snapshot).forEach((name) => {
        out[name] = asRecord(snapshot[name]) as QcaCalibrateControlSnapshotEntry;
    });

    return out;
};


export const createQcaCalibrateDialogState = function(
    parameters: Record<string, unknown>
): QcaCalibrateDialogViewState {
    const controls = readControls(parameters);
    const snapshot = readSnapshot(parameters);
    const thresholdValues = controls.thresholdInputs.map((name) => {
        return asText(readControlValue(snapshot, name));
    });
    const crisp = readControlChecked(snapshot, controls.typeCrisp)
        || (!readControlChecked(snapshot, controls.typeFuzzy) && asText(parameters.event) !== "type");
    const bell = readControlChecked(snapshot, controls.shapeBell);
    const state: QcaCalibrateDialogState = {
        selectedDataset: readControlSelected(snapshot, controls.datasetContainer),
        selectedVariable: readControlSelected(snapshot, controls.variableContainer),
        newConditionName: readControlValue(snapshot, controls.newConditionInput),
        useNewCondition: readControlChecked(snapshot, controls.newConditionCheckbox),
        type: crisp ? "crisp" : "fuzzy",
        crisp,
        bell,
        increasing: !readControlChecked(snapshot, controls.directionDec),
        thresholdCount: readControlValue(snapshot, controls.thresholdCount) || 1,
        thresholdValues,
        findThresholds: readControlChecked(snapshot, controls.findThresholdsCheckbox),
        logistic: readControlChecked(snapshot, controls.logisticCheckbox),
        ecdf: readControlChecked(snapshot, controls.ecdfCheckbox),
        jitter: readControlChecked(snapshot, controls.jitterCheckbox),
        idm: readControlValue(snapshot, controls.idmInput) || "0.95",
        above: readControlValue(snapshot, controls.aboveInput) || "1",
        below: readControlValue(snapshot, controls.belowInput) || "1"
    };
    const thresholdNames = getQcaCalibrateThresholdNames(state);
    const visibleThresholdCount = getQcaCalibrateVisibleThresholdCount(state);

    return {
        controls,
        state,
        thresholdNames,
        visibleThresholdCount,
        thresholdValues,
        previewPayload: null,
        validation: validateQcaCalibrateDialog(state)
    };
};


export const withQcaCalibrateRuntimePayloads = function(
    viewState: QcaCalibrateDialogViewState,
    thresholds: unknown,
    previewPayload: unknown
): QcaCalibrateDialogViewState {
    const thresholdRecord = asRecord(thresholds);
    const thresholdValues = asStringArray(thresholdRecord.thresholds).length
        ? asStringArray(thresholdRecord.thresholds)
        : viewState.thresholdValues;
    const nextState = {
        ...viewState.state,
        thresholdValues
    };

    return {
        ...viewState,
        state: nextState,
        thresholdValues,
        previewPayload,
        validation: validateQcaCalibrateDialog(nextState)
    };
};


export const isQcaCalibrateCrisp = function(state: QcaCalibrateDialogState): boolean {
    return asBoolean(state.crisp) || asText(state.type) === "crisp";
};


export const getQcaCalibrateVisibleThresholdCount = function(state: QcaCalibrateDialogState): number {
    if (!isQcaCalibrateCrisp(state)) {
        return asBoolean(state.bell) ? 6 : 3;
    }

    const requestedCount = Math.floor(asNumber(state.thresholdCount));
    if (!Number.isFinite(requestedCount)) {
        return 1;
    }

    return Math.max(1, Math.min(6, requestedCount));
};


export const getQcaCalibrateThresholdNames = function(state: QcaCalibrateDialogState): string[] {
    if (isQcaCalibrateCrisp(state)) {
        return ["th1", "th2", "th3", "th4", "th5", "th6"];
    }

    const increasing = state.increasing !== false && state.increasing !== "false";
    if (asBoolean(state.bell)) {
        return increasing ? ["e1", "c1", "i1", "i2", "c2", "e2"] : ["i1", "c1", "e1", "e2", "c2", "i2"];
    }

    return increasing ? ["e", "c", "i"] : ["i", "c", "e"];
};


const usesShapeForm = function(state: QcaCalibrateDialogState): boolean {
    return !isQcaCalibrateCrisp(state) && !asBoolean(state.logistic) && !asBoolean(state.ecdf);
};


const readTargetName = function(state: QcaCalibrateDialogState): string {
    const requested = asBoolean(state.useNewCondition) ? asText(state.newConditionName) : "";
    return requested || asText(state.selectedVariable);
};


const listValidThresholds = function(state: QcaCalibrateDialogState): Array<{ value: string; index: number }> {
    return asThresholdValues(state.thresholdValues).map((value, index) => {
        return { value, index };
    }).filter((entry) => {
        return Boolean(entry.value) && entry.value !== "undefined";
    });
};


export const buildQcaCalibrateCommand = function(state: QcaCalibrateDialogState): string {
    const dataset = asText(state.selectedDataset);
    const variable = asText(state.selectedVariable);
    const target = readTargetName(state);

    if (!dataset || !variable || !target) {
        return "";
    }

    const crisp = isQcaCalibrateCrisp(state);
    const thresholdNames = getQcaCalibrateThresholdNames(state);
    const validThresholds = listValidThresholds(state);
    const args = [variable];

    if (crisp) {
        args.push("type = \"crisp\"");
    }

    if (validThresholds.length === 1 && crisp) {
        args.push("thresholds = " + validThresholds[0].value);
    } else if (validThresholds.length > 1 && crisp) {
        args.push("thresholds = c(" + validThresholds.map((entry) => {
            return entry.value;
        }).join(", ") + ")");
    } else if (validThresholds.length > 1) {
        const firstName = String(thresholdNames[0] || "");
        if ((validThresholds.length === 3 && firstName.substring(1, 2) !== "1") || validThresholds.length === 6) {
            args.push("thresholds = \"" + validThresholds.map((entry) => {
                return thresholdNames[entry.index] + "=" + entry.value;
            }).join(", ") + "\"");
        }
    }

    if (!crisp && !asBoolean(state.bell)) {
        if (!asBoolean(state.logistic)) {
            const extra = ["logistic = FALSE"];
            if (asBoolean(state.ecdf)) {
                extra.push("ecdf = TRUE");
            }
            args.push(extra.join(", "));
        } else {
            const idm = asText(state.idm);
            if (idm && idm !== "0.95") {
                args.push("idm = " + idm);
            }
        }
    }

    const below = asText(state.below);
    const above = asText(state.above);
    const shapeFormArgs: string[] = [];
    if (usesShapeForm(state) && below && below !== "1") {
        shapeFormArgs.push("below = " + below);
    }
    if (usesShapeForm(state) && above && above !== "1") {
        shapeFormArgs.push("above = " + above);
    }
    if (shapeFormArgs.length) {
        args.push(shapeFormArgs.join(", "));
    }

    const lines = [
        "inside(" + dataset + ",",
        "  " + target + " <- calibrate(" + args[0] + (args.length > 1 ? "," : "")
    ];

    args.slice(1).forEach((arg, index) => {
        const suffix = index < args.length - 2 ? "," : "";
        lines.push("     " + arg + suffix);
    });

    lines.push("  )");
    lines.push(")");

    return lines.join("\n");
};


export const validateQcaCalibrateDialog = function(state: QcaCalibrateDialogState): QcaCalibrateValidationResult {
    const errors: string[] = [];

    if (!asText(state.selectedDataset)) {
        errors.push("No dataset selected");
    }

    if (!asText(state.selectedVariable)) {
        errors.push("No condition selected");
    }

    if (asBoolean(state.useNewCondition) && !asText(state.newConditionName)) {
        errors.push("New condition needs a name");
    }

    const visibleCount = getQcaCalibrateVisibleThresholdCount(state);
    const activeThresholds = listValidThresholds(state).filter((entry) => {
        return entry.index < visibleCount;
    });

    if (activeThresholds.length < visibleCount) {
        errors.push("All visible thresholds need numeric values");
    }

    activeThresholds.forEach((entry) => {
        if (!Number.isFinite(Number(entry.value))) {
            errors.push("Thresholds must be numeric");
        }
    });

    if (!isQcaCalibrateCrisp(state) && asBoolean(state.logistic) && !Number.isFinite(asNumber(state.idm))) {
        errors.push("Degree of membership must be numeric");
    }

    const above = asNumber(state.above);
    const below = asNumber(state.below);
    if (usesShapeForm(state) && (!Number.isFinite(above) || above <= 0 || !Number.isFinite(below) || below <= 0)) {
        errors.push("Shape form values must be positive");
    }

    const uniqueErrors = Array.from(new Set(errors));

    return {
        status: uniqueErrors.length ? "invalid" : "ready",
        command: uniqueErrors.length ? "" : buildQcaCalibrateCommand(state),
        errors: uniqueErrors
    };
};
