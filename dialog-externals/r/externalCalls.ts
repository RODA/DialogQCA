import type {
    ProfileCustomJSContext
} from "dialogforge/shared/dialog-runtime/renderer/modules/profileCustomJSApi";


export const QCA_EXTERNAL_CALLS = Object.freeze({
    LIST_TRUTH_TABLES: "qca.listTruthTables",
    GET_CALIBRATE_THRESHOLDS: "qca.getCalibrateThresholds",
    GET_CALIBRATE_PREVIEW: "qca.getCalibratePreview",
    RENDER_CALIBRATE_PREVIEW: "qca.renderCalibratePreview",
    INIT_CALIBRATE_DIALOG: "qca.initializeCalibrateDialog",
    SYNC_CALIBRATE_DIALOG: "qca.syncCalibrateDialog",
    VALIDATE_CALIBRATE_DIALOG: "qca.validateCalibrateDialog",
    INIT_CALIBRATE_THRESHOLDS: "qca.initializeCalibrateThresholdStore",
    SAVE_CALIBRATE_THRESHOLDS: "qca.saveCalibrateActiveThresholds",
    RESTORE_CALIBRATE_THRESHOLDS: "qca.restoreCalibrateActiveThresholds",
    GET_CALIBRATE_THRESHOLD_SPEC: "qca.getCalibrateActiveThresholdSpec",
    SET_CALIBRATE_VISIBLE_THRESHOLDS: "qca.setCalibrateVisibleThresholdValues",
    INSERT_CALIBRATE_THRESHOLD_VALUE: "qca.insertCalibrateThresholdValueFromPlot",
    GET_XYPLOT_PREVIEW: "qca.getXYPlotPreview",
    INIT_XYPLOT_DIALOG: "qca.initializeXYPlotDialog",
    SYNC_XYPLOT_DIALOG: "qca.syncXYPlotDialog",
    RENDER_VENN: "qca.renderVenn",
    INIT_VENN_DIALOG: "qca.initializeVennDialog",
    SYNC_VENN_DIALOG: "qca.syncVennDialog"
});


export const createQcaExternalInvoker = function(context: ProfileCustomJSContext) {
    return async function(
        name: string,
        parameters: Record<string, unknown> = {}
    ): Promise<unknown> {
        const result = await context.coms.invoke(
            "base-app:callDialogExternal",
            name,
            parameters
        );

        const response = result && typeof result === "object"
            ? result as Record<string, unknown>
            : {};

        if (response.status !== "ready") {
            throw new Error(
                String(
                    response.message
                    || `Dialog external call failed: ${name}`
                )
            );
        }

        return response.value;
    };
};
