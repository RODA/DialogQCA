import type {
    ProfileCustomJSApi,
    ProfileCustomJSContext
} from "dialogforge/shared/dialog-runtime/renderer/modules/profileCustomJSApi";
import {
    createCalibrateDialogRuntime
} from "../dialog-externals/r/calibrateDialogRuntime";
import {
    createCalibrateThresholdController
} from "../dialog-externals/r/calibrateThresholds";
import {
    createQcaDataAccess
} from "../dialog-externals/r/dataAccess";
import {
    createQcaDialogUi
} from "../dialog-externals/r/dialogUi";
import {
    createQcaExternalInvoker,
    QCA_EXTERNAL_CALLS
} from "../dialog-externals/r/externalCalls";
import type {
    DialogQcaRuntimeApi
} from "../dialog-externals/r/runtimeApi";
import {
    asPayloadRecord,
    asString
} from "../dialog-externals/r/runtimeApi";
import {
    createTruthTableAccess
} from "../dialog-externals/r/truthTables";
import {
    createVennDialogRuntime
} from "../dialog-externals/r/vennDialogRuntime";
import {
    createXYPlotDialogRuntime
} from "../dialog-externals/r/xyPlotDialogRuntime";


const registerRuntimeProxyCalls = function(options: {
    api: DialogQcaRuntimeApi;
    invoke: (
        name: string,
        parameters?: Record<string, unknown>
    ) => Promise<unknown>;
}): void {
    const register = options.api.registerExternalCall;

    if (!register) {
        return;
    }

    register(QCA_EXTERNAL_CALLS.GET_CALIBRATE_THRESHOLDS, async (parameters) => {
        const payload = asPayloadRecord(parameters);

        try {
            return await options.invoke("qca.getCalibrateThresholds", {
                dataset: payload.dataset || payload.name,
                variable: payload.variable || payload.variableName,
                thresholdCount: payload.thresholdCount || payload.nth || payload.count
            });
        } catch (error) {
            console.error("Unable to calculate QCA calibration thresholds", error);
            return null;
        }
    });

    register(QCA_EXTERNAL_CALLS.GET_CALIBRATE_PREVIEW, async (parameters) => {
        const payload = asPayloadRecord(parameters);

        try {
            return await options.invoke("qca.getCalibratePreview", {
                dataset: payload.dataset || payload.name,
                variable: payload.variable || payload.variableName,
                thresholds: payload.thresholds,
                thresholdNames: payload.thresholdNames,
                variant: payload.variant || payload.calibrateType,
                logistic: payload.logistic,
                ecdf: payload.ecdf,
                idm: payload.idm,
                below: payload.below,
                above: payload.above,
                increasing: payload.increasing,
                bell: payload.bell
            });
        } catch (error) {
            console.error("Unable to build QCA calibration preview", error);
            return null;
        }
    });

    register(QCA_EXTERNAL_CALLS.GET_XYPLOT_PREVIEW, async (parameters) => {
        const payload = asPayloadRecord(parameters);

        try {
            return await options.invoke("qca.getXYPlotPreview", {
                dataset: payload.dataset || payload.name,
                xVariable: payload.xVariable || payload.xVariableName,
                yVariable: payload.yVariable || payload.yVariableName
            });
        } catch (error) {
            console.error("Unable to build QCA XY plot preview", error);
            return null;
        }
    });
};


export const extendCustomJSApi = async function(
    api: ProfileCustomJSApi,
    context: ProfileCustomJSContext
): Promise<void> {
    const runtimeApi = api as unknown as DialogQcaRuntimeApi;
    const register = runtimeApi.registerExternalCall;

    if (!register) {
        return;
    }

    const invoke = createQcaExternalInvoker(context);
    const dataAccess = createQcaDataAccess(context);
    const dialogUi = createQcaDialogUi(runtimeApi, context);
    const thresholds = createCalibrateThresholdController(runtimeApi);
    const truthTables = createTruthTableAccess({
        api: runtimeApi,
        context,
        invoke
    });
    const calibration = createCalibrateDialogRuntime({
        api: runtimeApi,
        thresholds,
        getDialogKey: dialogUi.getDialogKey,
        setVisible: dialogUi.setVisible,
        setChecked: dialogUi.setChecked,
        getDatasetVariables: dataAccess.getDatasetVariables,
        getVariableValues: dataAccess.getVariableValues,
        listDatasetColumns: dataAccess.listDatasetColumns,
        invoke
    });
    const xyPlot = createXYPlotDialogRuntime({
        api: runtimeApi,
        getDialogKey: dialogUi.getDialogKey,
        setVisible: dialogUi.setVisible,
        setLabelWeight: dialogUi.setLabelWeight,
        getDatasetVariables: dataAccess.getDatasetVariables,
        getVariableValues: dataAccess.getVariableValues,
        listDatasetColumns: dataAccess.listDatasetColumns,
        invoke
    });
    const venn = createVennDialogRuntime({
        api: runtimeApi,
        loadTruthTables: truthTables.load,
        listTruthTableNames: truthTables.listAvailableNames
    });
    let vennWorkspaceWatcherAttached = false;

    truthTables.registerObjectSource();
    registerRuntimeProxyCalls({
        api: runtimeApi,
        invoke
    });

    register(QCA_EXTERNAL_CALLS.LIST_TRUTH_TABLES, async () => {
        return await truthTables.load();
    });

    register(QCA_EXTERNAL_CALLS.INIT_CALIBRATE_DIALOG, async (parameters) => {
        return await calibration.synchronize({
            ...asPayloadRecord(parameters),
            event: "init"
        });
    });
    register(QCA_EXTERNAL_CALLS.SYNC_CALIBRATE_DIALOG, async (parameters) => {
        return await calibration.synchronize(parameters);
    });
    register(QCA_EXTERNAL_CALLS.VALIDATE_CALIBRATE_DIALOG, async (parameters) => {
        return await calibration.validate(parameters);
    });
    register(QCA_EXTERNAL_CALLS.INIT_CALIBRATE_THRESHOLDS, (parameters) => {
        const context = thresholds.getContext(parameters);

        thresholds.resetState(context.stateKey);

        return null;
    });
    register(QCA_EXTERNAL_CALLS.SAVE_CALIBRATE_THRESHOLDS, (parameters) => {
        const thresholdContext = thresholds.getContext(parameters);
        const state = thresholds.getState(thresholdContext.stateKey);

        state.currentKey = thresholdContext.activeKey;
        state.store[thresholdContext.activeKey] = thresholds.readValues(
            thresholdContext.thresholdInputIds
        );

        return state.store[thresholdContext.activeKey].slice();
    });
    register(QCA_EXTERNAL_CALLS.RESTORE_CALIBRATE_THRESHOLDS, (parameters) => {
        const thresholdContext = thresholds.getContext(parameters);
        const state = thresholds.getState(thresholdContext.stateKey);
        const values = state.store[thresholdContext.activeKey] || [];

        state.currentKey = thresholdContext.activeKey;
        thresholds.applyVisibleValues(
            thresholdContext.thresholdInputIds,
            thresholdContext.visibleThresholdCount,
            values
        );

        return values.slice(0, thresholdContext.visibleThresholdCount);
    });
    register(QCA_EXTERNAL_CALLS.GET_CALIBRATE_THRESHOLD_SPEC, (parameters) => {
        return thresholds.buildSpec(parameters);
    });
    register(QCA_EXTERNAL_CALLS.SET_CALIBRATE_VISIBLE_THRESHOLDS, (parameters) => {
        const payload = asPayloadRecord(parameters);
        const thresholdContext = thresholds.getContext(parameters);
        const values = Array.isArray(payload.values)
            ? payload.values.map(asString)
            : [];

        thresholds.applyVisibleValues(
            thresholdContext.thresholdInputIds,
            thresholdContext.visibleThresholdCount,
            values
        );

        return values.slice(0, thresholdContext.visibleThresholdCount);
    });
    register(QCA_EXTERNAL_CALLS.INSERT_CALIBRATE_THRESHOLD_VALUE, (parameters) => {
        return thresholds.buildInsertion(parameters);
    });
    register(QCA_EXTERNAL_CALLS.RENDER_CALIBRATE_PREVIEW, (parameters) => {
        return calibration.renderPreview(parameters);
    });

    register(QCA_EXTERNAL_CALLS.INIT_XYPLOT_DIALOG, async (parameters) => {
        return await xyPlot.synchronize({
            ...asPayloadRecord(parameters),
            event: "init"
        });
    });
    register(QCA_EXTERNAL_CALLS.SYNC_XYPLOT_DIALOG, async (parameters) => {
        return await xyPlot.synchronize(parameters);
    });

    register(QCA_EXTERNAL_CALLS.RENDER_VENN, (parameters) => {
        return venn.render(parameters);
    });
    register(QCA_EXTERNAL_CALLS.INIT_VENN_DIALOG, async (parameters) => {
        const payload = asPayloadRecord(parameters);
        const truthTableSelect = asString(payload.truthTableSelect);

        venn.attachInputBlur(payload.customInput);

        if (truthTableSelect) {
            await venn.refreshTruthTableSelect(payload);

            if (!vennWorkspaceWatcherAttached) {
                vennWorkspaceWatcherAttached = true;
                context.objects?.events?.on?.("workspaceDataUpdated", () => {
                    void venn.refreshTruthTableSelect(payload).then(() => {
                        return venn.sync(payload);
                    });
                });
            }
        }

        return await venn.sync(payload);
    });
    register(QCA_EXTERNAL_CALLS.SYNC_VENN_DIALOG, (parameters) => {
        return venn.sync(parameters);
    });
};


export {
    QCA_EXTERNAL_CALLS as EXTERNAL_CALLS
} from "../dialog-externals/r/externalCalls";
