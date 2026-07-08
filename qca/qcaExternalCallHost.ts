import type {
    QcaCalibratePreviewRequest,
    QcaCalibrateThresholdRequest,
    QcaRuntimeBindings,
    QcaXYPlotPreviewRequest
} from "./qcaBindings";
import { createQcaRuntimeBindingsForSession } from "./qcaBindings";
import type { RuntimeSessionManager } from "dialogforge/shared/runtime/provider-contract/runtimeProvider";
import {
    createQcaCalibrateDialogState,
    getQcaCalibrateThresholdNames,
    validateQcaCalibrateDialog,
    withQcaCalibrateRuntimePayloads
} from "./qcaCalibrateDialog";
import { createQcaXYPlotDialogState } from "./qcaXYPlotDialog";
import {
    buildQcaVennRenderPayload,
    createQcaVennDialogState
} from "./qcaVennDialog";
import type { QcaTruthTableEntry } from "./qcaVennDialog";


export interface QcaExternalCallResult {
    status: string;
    name: string;
    value: unknown;
    message: string;
}


const implementedCalls = new Set([
    "qca.listTruthTables",
    "qca.getCalibrateThresholds",
    "qca.getCalibratePreview",
    "qca.validateCalibrateDialog",
    "qca.initializeCalibrateDialog",
    "qca.syncCalibrateDialog",
    "qca.renderCalibratePreview",
    "qca.getXYPlotPreview",
    "qca.initializeXYPlotDialog",
    "qca.syncXYPlotDialog",
    "qca.initializeVennDialog",
    "qca.syncVennDialog",
    "qca.renderVenn"
]);


const ok = function(name: string, value: unknown): QcaExternalCallResult {
    return {
        status: "ready",
        name,
        value,
        message: "DialogQCA external call resolved."
    };
};


const unsupported = function(name: string): QcaExternalCallResult {
    return {
        status: "unsupported",
        name,
        value: null,
        message: "DialogQCA external call is not implemented."
    };
};


const failed = function(name: string, error: unknown): QcaExternalCallResult {
    return {
        status: "failed",
        name,
        value: null,
        message: error instanceof Error ? error.message : String(error)
    };
};


const numberArray = function(value: unknown): number[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.map((entry) => {
        return Number(entry);
    }).filter((entry) => {
        return Number.isFinite(entry);
    });
};


const stringArray = function(value: unknown): string[] {
    return Array.isArray(value) ? value.map(String) : [];
};


const getObject = function(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
};


const getControlSnapshot = function(parameters: Record<string, unknown>): Record<string, Record<string, unknown>> {
    return getObject(parameters.__controlSnapshot) as Record<string, Record<string, unknown>>;
};


const getSelectedControlValue = function(parameters: Record<string, unknown>, controlName: string): string {
    const selected = getControlSnapshot(parameters)[controlName]?.selected;

    return Array.isArray(selected) ? String(selected[0] || "").trim() : "";
};


const getControlValue = function(parameters: Record<string, unknown>, controlName: string): string {
    return String(getControlSnapshot(parameters)[controlName]?.value || "").trim();
};


const getControlChecked = function(parameters: Record<string, unknown>, controlName: string): boolean {
    return getControlSnapshot(parameters)[controlName]?.checked === true;
};


const truthTablesFromValue = function(value: unknown): QcaTruthTableEntry[] {
    return Array.isArray(value) ? value as QcaTruthTableEntry[] : [];
};


export const createQcaExternalCallHost = function(bindings: QcaRuntimeBindings) {
    return {
        supports: function(name: string): boolean {
            return implementedCalls.has(name);
        },
        call: async function(name: string, parameters: Record<string, unknown> = {}): Promise<QcaExternalCallResult> {
            try {
                if (name === "qca.listTruthTables") {
                    return ok(name, await bindings.listTruthTables());
                }

                if (name === "qca.getCalibrateThresholds") {
                    return ok(name, await bindings.getCalibrateThresholds({
                        dataset: String(parameters.dataset || parameters.name || ""),
                        variable: String(parameters.variable || parameters.variableName || ""),
                        thresholdCount: Number(parameters.thresholdCount || parameters.count || 1)
                    } satisfies QcaCalibrateThresholdRequest));
                }

                if (name === "qca.getCalibratePreview") {
                    return ok(name, await bindings.getCalibratePreview({
                        dataset: String(parameters.dataset || parameters.name || ""),
                        variable: String(parameters.variable || parameters.variableName || ""),
                        thresholds: numberArray(parameters.thresholds),
                        thresholdNames: stringArray(parameters.thresholdNames),
                        variant: String(parameters.variant || "fuzzy"),
                        logistic: parameters.logistic === true,
                        ecdf: parameters.ecdf === true,
                        idm: parameters.idm === undefined ? undefined : Number(parameters.idm),
                        below: parameters.below === undefined ? undefined : Number(parameters.below),
                        above: parameters.above === undefined ? undefined : Number(parameters.above),
                        increasing: parameters.increasing !== false,
                        bell: parameters.bell === true
                    } satisfies QcaCalibratePreviewRequest));
                }

                if (name === "qca.validateCalibrateDialog") {
                    const state = parameters.__controlSnapshot
                        ? createQcaCalibrateDialogState(parameters).state
                        : parameters;

                    return ok(name, validateQcaCalibrateDialog(state).command);
                }

                if (name === "qca.initializeCalibrateDialog" || name === "qca.syncCalibrateDialog") {
                    const viewState = createQcaCalibrateDialogState(parameters);
                    const selectedDataset = String(viewState.state.selectedDataset || "");
                    const selectedVariable = String(viewState.state.selectedVariable || "");
                    const shouldFindThresholds = parameters.event === "thresholdCount"
                        || parameters.event === "variable"
                        || parameters.event === "findThresholds"
                        || viewState.state.useNewCondition === true;
                    const thresholds = shouldFindThresholds && selectedDataset && selectedVariable
                        ? await bindings.getCalibrateThresholds({
                            dataset: selectedDataset,
                            variable: selectedVariable,
                            thresholdCount: viewState.visibleThresholdCount
                        } satisfies QcaCalibrateThresholdRequest)
                        : null;
                    const thresholdValues = numberArray(thresholds && typeof thresholds === "object"
                        ? (thresholds as Record<string, unknown>).thresholds
                        : viewState.thresholdValues);
                    const preview = selectedDataset && selectedVariable && thresholdValues.length >= viewState.visibleThresholdCount
                        ? await bindings.getCalibratePreview({
                            dataset: selectedDataset,
                            variable: selectedVariable,
                            thresholds: thresholdValues,
                            thresholdNames: getQcaCalibrateThresholdNames(viewState.state),
                            variant: viewState.state.crisp === true ? "crisp" : "fuzzy",
                            logistic: viewState.state.logistic === true,
                            ecdf: viewState.state.ecdf === true,
                            idm: viewState.state.idm === undefined ? undefined : Number(viewState.state.idm),
                            below: viewState.state.below === undefined ? undefined : Number(viewState.state.below),
                            above: viewState.state.above === undefined ? undefined : Number(viewState.state.above),
                            increasing: viewState.state.increasing !== false,
                            bell: viewState.state.bell === true
                        } satisfies QcaCalibratePreviewRequest)
                        : null;

                    return ok(name, withQcaCalibrateRuntimePayloads(viewState, thresholds, preview));
                }

                if (name === "qca.renderCalibratePreview") {
                    return ok(name, createQcaCalibrateDialogState(parameters));
                }

                if (name === "qca.getXYPlotPreview") {
                    return ok(name, await bindings.getXYPlotPreview({
                        dataset: String(parameters.dataset || parameters.name || ""),
                        xVariable: String(parameters.xVariable || parameters.xVariableName || ""),
                        yVariable: String(parameters.yVariable || parameters.yVariableName || "")
                    } satisfies QcaXYPlotPreviewRequest));
                }

                if (name === "qca.initializeXYPlotDialog" || name === "qca.syncXYPlotDialog") {
                    const selectedDataset = String(
                        parameters.selectedDataset
                            || parameters.dataset
                            || getSelectedControlValue(parameters, String(parameters.datasetContainer || ""))
                            || ""
                    );
                    const selectedX = String(
                        parameters.selectedX
                            || parameters.xVariable
                            || parameters.xVariableName
                            || getSelectedControlValue(parameters, String(parameters.xContainer || ""))
                            || ""
                    );
                    const selectedY = String(
                        parameters.selectedY
                            || parameters.yVariable
                            || parameters.yVariableName
                            || getSelectedControlValue(parameters, String(parameters.yContainer || ""))
                            || ""
                    );
                    const plotData = parameters.plotData ?? (
                        selectedDataset && selectedX && selectedY
                            ? await bindings.getXYPlotPreview({
                                dataset: selectedDataset,
                                xVariable: selectedX,
                                yVariable: selectedY
                            } satisfies QcaXYPlotPreviewRequest)
                            : null
                    );

                    return ok(name, createQcaXYPlotDialogState({
                        ...parameters,
                        selectedDataset,
                        selectedX,
                        selectedY,
                        plotData,
                        necessity: parameters.necessity ?? getControlChecked(parameters, String(parameters.necessityRadio || "")),
                        negateX: parameters.negateX ?? getControlChecked(parameters, String(parameters.negateXCheckbox || "")),
                        negateY: parameters.negateY ?? getControlChecked(parameters, String(parameters.negateYCheckbox || "")),
                        showParametersOfFit: parameters.showParametersOfFit
                            ?? getControlChecked(parameters, String(parameters.pofCheckbox || "")),
                        showGuides: parameters.showGuides
                            ?? (parameters.guidesCheckbox
                                ? getControlChecked(parameters, String(parameters.guidesCheckbox || ""))
                                : true),
                        showCases: parameters.showCases
                            ?? getControlChecked(parameters, String(parameters.casesCheckbox || "")),
                        fillPoints: parameters.fillPoints
                            ?? (parameters.fillCheckbox
                                ? getControlChecked(parameters, String(parameters.fillCheckbox || ""))
                                : true),
                        jitterPoints: parameters.jitterPoints
                            ?? getControlChecked(parameters, String(parameters.jitterCheckbox || "")),
                        caseLabelRotation: parameters.caseLabelRotation
                            ?? getControlValue(parameters, String(parameters.rotateInput || ""))
                    }));
                }

                if (name === "qca.initializeVennDialog" || name === "qca.syncVennDialog") {
                    const truthTables = truthTablesFromValue(parameters.truthTables ?? await bindings.listTruthTables());
                    const truthTableName = String(
                        parameters.truthTableName
                            || parameters.selectedTruthTable
                            || getSelectedControlValue(parameters, String(parameters.truthTableSelect || ""))
                            || ""
                    ).trim();

                    return ok(name, createQcaVennDialogState({
                        truthTables,
                        truthTableName: truthTableName || undefined,
                        selectedTruthTable: truthTableName || undefined,
                        previousSelection: parameters.previousSelection,
                        customEnabled: parameters.customEnabled
                            ?? getControlChecked(parameters, String(parameters.customCheckbox || "")),
                        showCustom: parameters.showCustom
                            ?? getControlChecked(parameters, String(parameters.customCheckbox || "")),
                        customText: parameters.customText
                            ?? getControlValue(parameters, String(parameters.customInput || "")),
                        conditions: parameters.conditions
                    }));
                }

                if (name === "qca.renderVenn") {
                    const truthTables = truthTablesFromValue(parameters.truthTables ?? await bindings.listTruthTables());
                    const truthTableName = String(
                        parameters.truthTableName
                            || parameters.selectedTruthTable
                            || getSelectedControlValue(parameters, String(parameters.truthTableSelect || ""))
                            || ""
                    ).trim();

                    return ok(name, buildQcaVennRenderPayload({
                        truthTables,
                        truthTableName: truthTableName || undefined,
                        selectedTruthTable: truthTableName || undefined,
                        customEnabled: parameters.customEnabled
                            ?? getControlChecked(parameters, String(parameters.customCheckbox || "")),
                        showCustom: parameters.showCustom
                            ?? getControlChecked(parameters, String(parameters.customCheckbox || "")),
                        customText: parameters.customText
                            ?? getControlValue(parameters, String(parameters.customInput || "")),
                        conditions: parameters.conditions
                    }));
                }

                return unsupported(name);
            }
            catch (error) {
                return failed(name, error);
            }
        }
    };
};


export const createQcaExternalCallHostForSession = function(
    session: Pick<RuntimeSessionManager, "executeRuntimeMethod">,
    source = "DialogQCA.qca"
) {
    return createQcaExternalCallHost(createQcaRuntimeBindingsForSession(session, source));
};
