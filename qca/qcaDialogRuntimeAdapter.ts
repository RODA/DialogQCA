import type { DialogControlModel } from "../dialog-runtime/dialogControlModel";
import {
    applyQcaCalibrateDialogState,
    applyQcaVennDialogState,
    applyQcaXYPlotDialogState
} from "./qcaDialogControlAdapters";
import type { QcaCalibrateDialogViewState } from "./qcaCalibrateDialog";
import type { QcaVennDialogState } from "./qcaVennDialog";
import type { QcaXYPlotDialogState } from "./qcaXYPlotDialog";


const asRecord = function(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
};


const asStringArray = function(value: unknown): string[] {
    return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
};


const asText = function(value: unknown): string {
    return String(value ?? "").trim();
};


export const applyQcaExternalCallResultToControls = function(
    model: DialogControlModel,
    name: string,
    parameters: Record<string, unknown>,
    value: unknown
): boolean {
    if (name === "qca.initializeCalibrateDialog" || name === "qca.syncCalibrateDialog" || name === "qca.renderCalibratePreview") {
        applyQcaCalibrateDialogState(model, value as QcaCalibrateDialogViewState);

        return true;
    }

    if (name === "qca.initializeVennDialog" || name === "qca.syncVennDialog") {
        applyQcaVennDialogState(model, {
            truthTableSelect: asText(parameters.truthTableSelect),
            customInput: asText(parameters.customInput),
            plot: asText(parameters.target || parameters.plot)
        }, value as QcaVennDialogState);

        return true;
    }

    if (name === "qca.initializeXYPlotDialog" || name === "qca.syncXYPlotDialog") {
        applyQcaXYPlotDialogState(model, {
            rotateInput: asText(parameters.rotateInput),
            rotateLabel: asText(parameters.rotateLabel),
            xAxisLabel: asText(parameters.xAxisLabel),
            yAxisLabel: asText(parameters.yAxisLabel),
            measureLabels: asStringArray(parameters.measureLabels),
            measureValues: asStringArray(parameters.measureValues),
            separators: asStringArray(parameters.separators),
            plot: asText(parameters.plot)
        }, value as QcaXYPlotDialogState);

        return true;
    }

    if (name === "qca.renderVenn") {
        const state: QcaVennDialogState = {
            truthTableNames: [],
            selectedTruthTable: "",
            renderPayload: asRecord(value) as unknown as QcaVennDialogState["renderPayload"]
        };

        applyQcaVennDialogState(model, {
            truthTableSelect: asText(parameters.truthTableSelect),
            customInput: asText(parameters.customInput),
            plot: asText(parameters.target || parameters.plot)
        }, state);

        return true;
    }

    return false;
};


export const qcaDialogRuntimeAdapterApi = {
    applyQcaExternalCallResultToControls
};
