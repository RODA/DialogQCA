import type {
    RuntimeExtensionMethodResult,
    RuntimeSessionManager
} from "dialogforge/shared/runtime/provider-contract/runtimeProvider";


export interface QcaRuntimeExecutor {
    execute: (method: string, params: Record<string, unknown>) => Promise<unknown>;
}

const createRuntimeExtensionMethodRequest = function(input: {
    method: string;
    params?: Record<string, unknown>;
    source?: string;
}) {
    return {
        method: String(input.method || ""),
        params: input.params && typeof input.params === "object" && !Array.isArray(input.params)
            ? input.params
            : {},
        source: String(input.source || "DialogQCA.qca")
    };
};


export interface QcaCalibrateThresholdRequest {
    dataset: string;
    variable: string;
    thresholdCount: number;
}


export interface QcaCalibratePreviewRequest {
    dataset: string;
    variable: string;
    thresholds: number[];
    thresholdNames: string[];
    variant: string;
    logistic: boolean;
    ecdf: boolean;
    idm?: number;
    below?: number;
    above?: number;
    increasing: boolean;
    bell: boolean;
}


export interface QcaXYPlotPreviewRequest {
    dataset: string;
    xVariable: string;
    yVariable: string;
}


export interface QcaFissDialogRequest {
    solutionName?: string;
    branch?: string;
    model?: string;
    ambiguity?: string;
    coreSelections?: Record<string, string>;
    title?: string;
    legend?: boolean;
    useLabels?: boolean;
}


export interface QcaFissPdfExport {
    dataHex: string;
    width: number;
    height: number;
}


export interface QcaRuntimeBindings {
    listTruthTables: () => Promise<Record<string, unknown>[]>;
    getCalibrateThresholds: (request: QcaCalibrateThresholdRequest) => Promise<Record<string, unknown>>;
    getCalibratePreview: (request: QcaCalibratePreviewRequest) => Promise<Record<string, unknown>>;
    getXYPlotPreview: (request: QcaXYPlotPreviewRequest) => Promise<Record<string, unknown>>;
    getFissDialogState: (request: QcaFissDialogRequest) => Promise<Record<string, unknown>>;
    exportFissPdf: (request: QcaFissDialogRequest) => Promise<QcaFissPdfExport>;
}


const asObject = function(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
};


const asArray = function(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
};


const parseRuntimePayload = function(value: unknown): unknown {
    if (typeof value !== "string") {
        return value;
    }

    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
};


const readRuntimeMethodValue = function(result: RuntimeExtensionMethodResult): unknown {
    if (result.status === "ready") {
        return result.value;
    }

    throw new Error(result.message || "DialogQCA runtime method failed: " + result.method);
};


export const createQcaRuntimeBindings = function(executor: QcaRuntimeExecutor): QcaRuntimeBindings {
    return {
        listTruthTables: async function(): Promise<Record<string, unknown>[]> {
            const result = parseRuntimePayload(await executor.execute("workspace.truth_tables", {}));

            return asArray(result).map((entry) => {
                return asObject(entry);
            });
        },
        getCalibrateThresholds: async function(request: QcaCalibrateThresholdRequest): Promise<Record<string, unknown>> {
            return asObject(parseRuntimePayload(await executor.execute("workspace.dataset_calibrate_thresholds", {
                name: request.dataset,
                variableName: request.variable,
                count: request.thresholdCount
            })));
        },
        getCalibratePreview: async function(request: QcaCalibratePreviewRequest): Promise<Record<string, unknown>> {
            return asObject(parseRuntimePayload(await executor.execute("workspace.dataset_calibrate_preview", {
                name: request.dataset,
                variableName: request.variable,
                thresholds: request.thresholds,
                thresholdNames: request.thresholdNames,
                variant: request.variant,
                logistic: request.logistic,
                ecdf: request.ecdf,
                idm: request.idm,
                below: request.below,
                above: request.above,
                increasing: request.increasing,
                bell: request.bell
            })));
        },
        getXYPlotPreview: async function(request: QcaXYPlotPreviewRequest): Promise<Record<string, unknown>> {
            return asObject(parseRuntimePayload(await executor.execute("workspace.dataset_xyplot_preview", {
                name: request.dataset,
                xVariableName: request.xVariable,
                yVariableName: request.yVariable
            })));
        },
        getFissDialogState: async function(request: QcaFissDialogRequest): Promise<Record<string, unknown>> {
            return asObject(parseRuntimePayload(await executor.execute("workspace.fiss_dialog_state", {
                solutionName: request.solutionName,
                branch: request.branch,
                model: request.model,
                ambiguity: request.ambiguity,
                coreSelections: request.coreSelections,
                title: request.title,
                legend: request.legend,
                useLabels: request.useLabels
            })));
        },
        exportFissPdf: async function(request: QcaFissDialogRequest): Promise<QcaFissPdfExport> {
            const value = asObject(parseRuntimePayload(await executor.execute("workspace.fiss_export_pdf", {
                solutionName: request.solutionName,
                branch: request.branch,
                model: request.model,
                ambiguity: request.ambiguity,
                coreSelections: request.coreSelections,
                title: request.title,
                legend: request.legend,
                useLabels: request.useLabels
            })));

            return {
                dataHex: String(value.dataHex || ""),
                width: Number(value.width || 0),
                height: Number(value.height || 0)
            };
        }
    };
};


export const createQcaRuntimeBindingsForSession = function(
    session: Pick<RuntimeSessionManager, "executeRuntimeMethod">,
    source = "DialogQCA.qca"
): QcaRuntimeBindings {
    return createQcaRuntimeBindings({
        execute: async function(method: string, params: Record<string, unknown>): Promise<unknown> {
            const result = await session.executeRuntimeMethod(createRuntimeExtensionMethodRequest({
                method,
                params,
                source
            }));

            return readRuntimeMethodValue(result);
        }
    });
};
