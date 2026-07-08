import type {
    CalibrateThresholdContext,
    CalibrateThresholdState
} from "./calibrateThresholds";
import {
    createCalibratePreviewRenderer
} from "./calibratePreviewRenderer";
import type {
    DialogQcaRuntimeApi
} from "./runtimeApi";
import {
    asPayloadRecord,
    asString,
    firstSelected
} from "./runtimeApi";


interface CalibrateThresholdController {
    applyVisibleValues: (
        inputIds: string[],
        visibleCount: number,
        values: string[]
    ) => void;
    buildInsertion: (payload: unknown) => string[];
    buildSpec: (payload: unknown) => Array<{
        index: number;
        name: string;
        value: string;
        numeric: number | null;
    }>;
    getContext: (payload: unknown) => CalibrateThresholdContext;
    getNames: (
        isCrisp: boolean,
        isBell: boolean,
        isIncreasing: boolean
    ) => string[];
    getState: (stateKey: string) => CalibrateThresholdState;
    getStoredValues: (context: CalibrateThresholdContext) => string[];
    readValues: (inputIds: string[]) => string[];
    resetState: (stateKey: string) => CalibrateThresholdState;
}


interface CalibrateDialogConfig extends Record<string, unknown> {
    dialogKey: string;
    stateKey: string;
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
    event: string;
}


interface CalibrateDialogState {
    selectedDataset: string;
    selectedVariable: string;
    variableValues: number[];
    variableRowNames: string[];
    variableValuesLoading: boolean;
    variableValuesError: string;
    variableValuesRequestKey: string;
    fuzzyPreviewValues: number[];
    suppressThresholdChange: boolean;
    lastVisibleThresholdCount: number;
    jitterEnabled: boolean;
    jitterOffsets: number[];
}


interface CalibrateDialogOptions {
    api: DialogQcaRuntimeApi;
    thresholds: CalibrateThresholdController;
    getDialogKey: (prefix: string, payload: unknown) => string;
    setVisible: (elementName: string, visible: boolean) => void;
    setChecked: (elementName: string, checked: boolean) => void;
    getDatasetVariables: (
        dataset: string
    ) => Promise<Record<string, unknown>[] | null>;
    getVariableValues: (
        dataset: string,
        variable: string
    ) => Promise<unknown>;
    listDatasetColumns: (dataset: string) => string[];
    invoke: (
        channel: string,
        payload?: Record<string, unknown>
    ) => Promise<unknown>;
}


const createInitialState = function(): CalibrateDialogState {
    return {
        selectedDataset: "",
        selectedVariable: "",
        variableValues: [],
        variableRowNames: [],
        variableValuesLoading: false,
        variableValuesError: "",
        variableValuesRequestKey: "",
        fuzzyPreviewValues: [],
        suppressThresholdChange: false,
        lastVisibleThresholdCount: 3,
        jitterEnabled: false,
        jitterOffsets: []
    };
};


export const createCalibrateDialogRuntime = function(
    options: CalibrateDialogOptions
) {
    const states = new Map<string, CalibrateDialogState>();

    const getConfig = function(payload: unknown): CalibrateDialogConfig {
        const source = asPayloadRecord(payload);
        const readNames = function(value: unknown): string[] {
            return Array.isArray(value) ? value.map(asString).filter(Boolean) : [];
        };
        const read = function(name: string): string {
            return asString(source[name]);
        };

        return {
            ...source,
            dialogKey: options.getDialogKey("calibrate", payload),
            stateKey: read("stateKey") || "qca.calibrate.thresholds",
            datasetContainer: read("datasetContainer"),
            variableContainer: read("variableContainer"),
            typeCrisp: read("typeCrisp"),
            typeFuzzy: read("typeFuzzy"),
            shapeBell: read("shapeBell"),
            shapeS: read("shapeS"),
            directionInc: read("directionInc"),
            directionDec: read("directionDec"),
            thresholdCount: read("thresholdCount"),
            thresholdInputs: readNames(source.thresholdInputs),
            thresholdLabels: readNames(source.thresholdLabels),
            findThresholdsCheckbox: read("findThresholdsCheckbox"),
            logisticCheckbox: read("logisticCheckbox"),
            ecdfCheckbox: read("ecdfCheckbox"),
            jitterCheckbox: read("jitterCheckbox"),
            newConditionCheckbox: read("newConditionCheckbox"),
            newConditionInput: read("newConditionInput"),
            idmInput: read("idmInput"),
            aboveInput: read("aboveInput"),
            belowInput: read("belowInput"),
            plot: read("plot"),
            shapeLabel: read("shapeLabel"),
            shapeSLabel: read("shapeSLabel"),
            shapeBellLabel: read("shapeBellLabel"),
            directionLabel: read("directionLabel"),
            directionIncLabel: read("directionIncLabel"),
            directionDecLabel: read("directionDecLabel"),
            thresholdCountLabel: read("thresholdCountLabel"),
            findThresholdsLabel: read("findThresholdsLabel"),
            jitterLabel: read("jitterLabel"),
            logisticLabel: read("logisticLabel"),
            ecdfLabel: read("ecdfLabel"),
            idmLabel: read("idmLabel"),
            shapeFormLabel: read("shapeFormLabel"),
            aboveLabel: read("aboveLabel"),
            belowLabel: read("belowLabel"),
            event: read("event")
        };
    };

    const getState = function(dialogKey: string): CalibrateDialogState {
        if (!states.has(dialogKey)) {
            states.set(dialogKey, createInitialState());
        }

        return states.get(dialogKey)!;
    };

    const getVisibleThresholdCount = function(
        config: CalibrateDialogConfig
    ): number {
        if (options.api.isChecked?.(config.typeCrisp)) {
            const value = Number(options.api.getValue?.(config.thresholdCount) || 1);

            return Math.max(
                1,
                Math.min(
                    config.thresholdInputs.length || 6,
                    Number.isFinite(value) ? value : 1
                )
            );
        }

        return options.api.isChecked?.(config.shapeBell) ? 6 : 3;
    };

    const getThresholdNames = function(config: CalibrateDialogConfig): string[] {
        return options.thresholds.getNames(
            options.api.isChecked?.(config.typeCrisp) === true,
            options.api.isChecked?.(config.shapeBell) === true,
            options.api.isChecked?.(config.directionInc) === true
        );
    };

    const buildThresholdPayload = function(
        config: CalibrateDialogConfig
    ): Record<string, unknown> {
        return {
            stateKey: config.stateKey,
            thresholdInputIds: config.thresholdInputs.slice(),
            visibleThresholdCount: getVisibleThresholdCount(config),
            isCrisp: options.api.isChecked?.(config.typeCrisp) === true,
            isBell: options.api.isChecked?.(config.shapeBell) === true,
            isIncreasing: options.api.isChecked?.(config.directionInc) === true
        };
    };

    const persistThresholdValues = function(
        config: CalibrateDialogConfig,
        values: string[]
    ): void {
        const context = options.thresholds.getContext(
            buildThresholdPayload(config)
        );
        const state = options.thresholds.getState(context.stateKey);

        state.currentKey = context.activeKey;
        state.store[context.activeKey] = new Array(
            context.thresholdInputIds.length
        ).fill("").map((_value, index) => {
            return asString(values[index]);
        });
    };

    const saveThresholdValues = function(config: CalibrateDialogConfig): void {
        const context = options.thresholds.getContext(
            buildThresholdPayload(config)
        );

        persistThresholdValues(
            config,
            options.thresholds.readValues(context.thresholdInputIds)
        );
    };

    const restoreThresholdValues = function(config: CalibrateDialogConfig): void {
        const context = options.thresholds.getContext(
            buildThresholdPayload(config)
        );
        const state = options.thresholds.getState(context.stateKey);

        state.currentKey = context.activeKey;
        options.thresholds.applyVisibleValues(
            context.thresholdInputIds,
            context.visibleThresholdCount,
            state.store[context.activeKey] || []
        );
    };

    const getThresholdSpec = function(config: CalibrateDialogConfig) {
        return options.thresholds.buildSpec(buildThresholdPayload(config));
    };

    const rebuildJitter = function(state: CalibrateDialogState): void {
        state.jitterOffsets = state.variableValues.map(() => {
            return Math.random() * 18 - 9;
        });
    };

    const usesShapeForm = function(config: CalibrateDialogConfig): boolean {
        return !options.api.isChecked?.(config.typeCrisp)
            && !options.api.isChecked?.(config.logisticCheckbox)
            && !options.api.isChecked?.(config.ecdfCheckbox);
    };

    const buildThresholdFallback = function(
        values: number[],
        count: number,
        existing: number[]
    ): number[] {
        const finiteValues = values.filter(Number.isFinite).sort((a, b) => {
            return a - b;
        });

        if (!finiteValues.length) {
            return existing.slice();
        }

        const fallback = Array.from({ length: count }, (_value, index) => {
            const probability = (index + 1) / (count + 1);
            const position = (finiteValues.length - 1) * probability;
            const lower = Math.floor(position);
            const upper = Math.ceil(position);

            if (lower === upper) {
                return finiteValues[lower];
            }

            const weight = position - lower;

            return finiteValues[lower] * (1 - weight)
                + finiteValues[upper] * weight;
        });
        const result = [...existing, ...fallback]
            .filter(Number.isFinite)
            .sort((a, b) => a - b)
            .slice(0, count);

        while (result.length < count && result.length) {
            result.push(result[result.length - 1]);
        }

        return result;
    };

    const canPreviewFuzzy = function(
        config: CalibrateDialogConfig,
        state: CalibrateDialogState
    ): boolean {
        if (
            !state.selectedDataset
            || !state.selectedVariable
            || options.api.isChecked?.(config.typeCrisp)
        ) {
            return false;
        }

        const spec = getThresholdSpec(config);

        if (
            spec.length < getVisibleThresholdCount(config)
            || spec.some((item) => item.numeric === null)
        ) {
            return false;
        }

        const logistic = options.api.isChecked?.(config.logisticCheckbox) === true;
        const idm = Number(asString(options.api.getValue?.(config.idmInput)));

        if (logistic) {
            return Number.isFinite(idm);
        }

        if (!usesShapeForm(config)) {
            return true;
        }

        const above = Number(asString(options.api.getValue?.(config.aboveInput)));
        const below = Number(asString(options.api.getValue?.(config.belowInput)));

        return Number.isFinite(above)
            && above > 0
            && Number.isFinite(below)
            && below > 0;
    };

    const buildCommand = function(
        config: CalibrateDialogConfig,
        state: CalibrateDialogState
    ): string {
        if (!state.selectedDataset || !state.selectedVariable) {
            return "";
        }

        const requestedTarget = options.api.isChecked?.(
            config.newConditionCheckbox
        )
            ? asString(options.api.getValue?.(config.newConditionInput))
            : "";
        const target = requestedTarget || state.selectedVariable;

        if (!target) {
            return "";
        }

        const type = options.api.isChecked?.(config.typeCrisp)
            ? "crisp"
            : "fuzzy";
        const thresholdNames = getThresholdNames(config);
        const validThresholds = config.thresholdInputs.map((name, index) => {
            return {
                index,
                value: asString(options.api.getValue?.(name))
            };
        }).filter((entry) => {
            return entry.value && entry.value !== "undefined";
        });
        const argumentsList = [state.selectedVariable];

        if (type === "crisp") {
            argumentsList.push('type = "crisp"');

            if (validThresholds.length === 1) {
                argumentsList.push(`thresholds = ${validThresholds[0].value}`);
            } else if (validThresholds.length > 1) {
                argumentsList.push(
                    `thresholds = c(${validThresholds.map((entry) => {
                        return entry.value;
                    }).join(", ")})`
                );
            }
        } else if (validThresholds.length > 1) {
            const firstName = thresholdNames[0] || "";

            if (
                (validThresholds.length === 3 && firstName.substring(1, 2) !== "1")
                || validThresholds.length === 6
            ) {
                argumentsList.push(
                    `thresholds = "${validThresholds.map((entry) => {
                        return `${thresholdNames[entry.index]}=${entry.value}`;
                    }).join(", ")}"`
                );
            }
        }

        if (type === "fuzzy" && !options.api.isChecked?.(config.shapeBell)) {
            if (!options.api.isChecked?.(config.logisticCheckbox)) {
                const values = ["logistic = FALSE"];

                if (options.api.isChecked?.(config.ecdfCheckbox)) {
                    values.push("ecdf = TRUE");
                }

                argumentsList.push(values.join(", "));
            } else {
                const idm = asString(options.api.getValue?.(config.idmInput));

                if (idm && idm !== "0.95") {
                    argumentsList.push(`idm = ${idm}`);
                }
            }
        }

        if (type === "fuzzy" && usesShapeForm(config)) {
            const shapeArguments: string[] = [];
            const below = asString(options.api.getValue?.(config.belowInput));
            const above = asString(options.api.getValue?.(config.aboveInput));

            if (below && below !== "1") {
                shapeArguments.push(`below = ${below}`);
            }

            if (above && above !== "1") {
                shapeArguments.push(`above = ${above}`);
            }

            if (shapeArguments.length) {
                argumentsList.push(shapeArguments.join(", "));
            }
        }

        const lines = [
            `inside(${state.selectedDataset},`,
            `  ${target} <- calibrate(${argumentsList[0]}${argumentsList.length > 1 ? "," : ""}`
        ];

        argumentsList.slice(1).forEach((argument, index) => {
            const suffix = index < argumentsList.length - 2 ? "," : "";

            lines.push(`     ${argument}${suffix}`);
        });
        lines.push("  )", ")");

        return lines.join("\n");
    };

    let synchronize: (payload: unknown) => Promise<null>;

    const previewRenderer = createCalibratePreviewRenderer({
        api: options.api,
        buildThresholdInsertion: options.thresholds.buildInsertion,
        onThresholdValuesChanged: async (dialogConfig, values) => {
            const config = getConfig(dialogConfig);

            persistThresholdValues(config, values);
            await synchronize({
                ...dialogConfig,
                event: "thresholdInput"
            });
        }
    });

    const refresh = function(
        config: CalibrateDialogConfig,
        state: CalibrateDialogState
    ): void {
        options.setVisible(
            config.newConditionInput,
            options.api.isChecked?.(config.newConditionCheckbox) === true
        );

        const thresholdNames = getThresholdNames(config);
        const visibleCount = getVisibleThresholdCount(config);

        config.thresholdLabels.forEach((name, index) => {
            const visible = index < visibleCount;

            if (visible) {
                options.api.setValue?.(name, thresholdNames[index] || "");
            }

            options.setVisible(name, visible);
            options.setVisible(config.thresholdInputs[index] || "", visible);
        });

        const crisp = options.api.isChecked?.(config.typeCrisp) === true;
        const bell = options.api.isChecked?.(config.shapeBell) === true;
        const logistic = options.api.isChecked?.(config.logisticCheckbox) === true;
        const ecdf = options.api.isChecked?.(config.ecdfCheckbox) === true;

        [
            config.thresholdCountLabel,
            config.thresholdCount,
            config.findThresholdsCheckbox,
            config.findThresholdsLabel,
            config.jitterCheckbox,
            config.jitterLabel
        ].forEach((name) => options.setVisible(name, crisp));
        [
            config.shapeLabel,
            config.shapeS,
            config.shapeSLabel,
            config.shapeBell,
            config.shapeBellLabel,
            config.directionLabel,
            config.directionInc,
            config.directionIncLabel,
            config.directionDec,
            config.directionDecLabel
        ].forEach((name) => options.setVisible(name, !crisp));

        const showFuzzyMethod = !crisp && !bell;

        options.setVisible(config.logisticCheckbox, showFuzzyMethod);
        options.setVisible(config.logisticLabel, showFuzzyMethod);
        options.setVisible(config.ecdfCheckbox, showFuzzyMethod);
        options.setVisible(config.ecdfLabel, showFuzzyMethod);
        options.setVisible(config.idmLabel, showFuzzyMethod && logistic);
        options.setVisible(config.idmInput, showFuzzyMethod && logistic);

        const showShapeForm = !crisp && !logistic && !ecdf;

        [
            config.shapeFormLabel,
            config.aboveLabel,
            config.aboveInput,
            config.belowLabel,
            config.belowInput
        ].forEach((name) => options.setVisible(name, showShapeForm));

        void previewRenderer.render({
            dialogConfig: config,
            target: config.plot,
            thresholdInputIds: config.thresholdInputs,
            thresholdValues: config.thresholdInputs.map((name) => {
                return asString(options.api.getValue?.(name));
            }),
            visibleThresholdCount: visibleCount,
            selectedDataset: state.selectedDataset,
            selectedVariable: state.selectedVariable,
            variableValuesLoading: state.variableValuesLoading,
            variableValuesError: state.variableValuesError,
            hasFuzzyCurve: !crisp
                && state.fuzzyPreviewValues.length === state.variableValues.length,
            jitterEnabled: options.api.isChecked?.(config.jitterCheckbox) === true,
            jitterOffsets: state.jitterOffsets,
            thresholds: getThresholdSpec(config),
            plotPoints: state.variableValues.map((value, index) => {
                return {
                    x: Number(value),
                    rowName: asString(state.variableRowNames[index])
                        || `Row ${index + 1}`,
                    fuzzy: Number(state.fuzzyPreviewValues[index])
                };
            }).filter((point) => Number.isFinite(point.x))
        });

        state.lastVisibleThresholdCount = visibleCount;
        options.api.updateSyntax?.(buildCommand(config, state));
    };

    const requestFuzzyPreview = async function(
        config: CalibrateDialogConfig,
        state: CalibrateDialogState
    ): Promise<void> {
        if (!canPreviewFuzzy(config, state)) {
            state.fuzzyPreviewValues = [];
            refresh(config, state);
            return;
        }

        const spec = getThresholdSpec(config);
        const request: Record<string, unknown> = {
            dataset: state.selectedDataset,
            variable: state.selectedVariable,
            thresholds: spec.map((item) => item.numeric).filter((value) => {
                return value !== null;
            }),
            thresholdNames: spec.map((item) => item.name),
            variant: "fuzzy",
            logistic: options.api.isChecked?.(config.logisticCheckbox) === true,
            ecdf: options.api.isChecked?.(config.ecdfCheckbox) === true,
            idm: Number(asString(options.api.getValue?.(config.idmInput))),
            increasing: options.api.isChecked?.(config.directionInc) === true,
            bell: options.api.isChecked?.(config.shapeBell) === true
        };

        if (usesShapeForm(config)) {
            request.below = Number(
                asString(options.api.getValue?.(config.belowInput))
            );
            request.above = Number(
                asString(options.api.getValue?.(config.aboveInput))
            );
        }

        let result: unknown = null;

        try {
            result = await options.invoke("qca.getCalibratePreview", request);
        } catch (error) {
            console.error("Unable to build QCA calibration preview", error);
        }

        const response = asPayloadRecord(result);

        state.fuzzyPreviewValues = Array.isArray(response.values)
            ? response.values.map(Number)
            : [];
        refresh(config, state);
    };

    const requestCrispThresholds = async function(
        config: CalibrateDialogConfig,
        state: CalibrateDialogState
    ): Promise<void> {
        if (
            !state.selectedDataset
            || !state.selectedVariable
            || !options.api.isChecked?.(config.typeCrisp)
            || !options.api.isChecked?.(config.findThresholdsCheckbox)
        ) {
            refresh(config, state);
            return;
        }

        const count = Math.max(
            1,
            Math.min(
                config.thresholdInputs.length || 6,
                Number(options.api.getValue?.(config.thresholdCount) || 1)
            )
        );
        let result: unknown = null;

        try {
            result = await options.invoke("qca.getCalibrateThresholds", {
                dataset: state.selectedDataset,
                variable: state.selectedVariable,
                thresholdCount: count
            });
        } catch (error) {
            console.error("Unable to calculate QCA calibration thresholds", error);
        }

        const response = asPayloadRecord(result);
        let found = Array.isArray(response.thresholds)
            ? response.thresholds.map(Number).filter(Number.isFinite)
            : [];
        const visibleCount = getVisibleThresholdCount(config);

        if (found.length < visibleCount) {
            found = buildThresholdFallback(
                state.variableValues,
                visibleCount,
                found
            );
        }

        state.suppressThresholdChange = true;
        options.thresholds.applyVisibleValues(
            config.thresholdInputs,
            visibleCount,
            new Array(visibleCount).fill("").map((_value, index) => {
                const value = found[index];

                return Number.isFinite(value)
                    ? String(Math.round(value * 1000) / 1000)
                    : "";
            })
        );
        state.suppressThresholdChange = false;
        saveThresholdValues(config);
        state.fuzzyPreviewValues = [];
        refresh(config, state);
    };

    const loadVariableValues = async function(
        config: CalibrateDialogConfig,
        state: CalibrateDialogState
    ): Promise<void> {
        state.variableValues = [];
        state.variableRowNames = [];
        state.variableValuesError = "";
        state.fuzzyPreviewValues = [];

        if (!state.selectedDataset || !state.selectedVariable) {
            state.variableValuesLoading = false;
            state.variableValuesRequestKey = "";
            refresh(config, state);
            return;
        }

        const requestKey = `${state.selectedDataset}::${state.selectedVariable}`;

        state.variableValuesRequestKey = requestKey;
        state.variableValuesLoading = true;
        refresh(config, state);

        const result = asPayloadRecord(
            await options.getVariableValues(
                state.selectedDataset,
                state.selectedVariable
            )
        );

        if (state.variableValuesRequestKey !== requestKey) {
            return;
        }

        state.variableValuesLoading = false;

        if (result.isNumeric !== true || !Array.isArray(result.values)) {
            state.variableValuesError = "Selected condition is not numeric";
            refresh(config, state);
            return;
        }

        state.variableValues = result.values.map(Number);
        state.variableRowNames = Array.isArray(result.rowNames)
            ? result.rowNames.map(asString)
            : [];
        state.variableValuesError = state.variableValues.length
            ? ""
            : "No numeric values available for plotting";
        rebuildJitter(state);
        state.jitterEnabled = options.api.isChecked?.(config.jitterCheckbox) === true;

        if (
            options.api.isChecked?.(config.typeCrisp)
            && options.api.isChecked?.(config.findThresholdsCheckbox)
        ) {
            await requestCrispThresholds(config, state);
        } else if (canPreviewFuzzy(config, state)) {
            await requestFuzzyPreview(config, state);
        } else {
            refresh(config, state);
        }
    };

    const populateVariables = async function(
        config: CalibrateDialogConfig,
        state: CalibrateDialogState
    ): Promise<void> {
        const metadata = await options.getDatasetVariables(state.selectedDataset);
        const variables = metadata?.length
            ? metadata
            : options.listDatasetColumns(state.selectedDataset);

        options.api.setValue?.(config.variableContainer, variables);
        state.selectedVariable = firstSelected(
            options.api.getSelected?.(config.variableContainer)
        );
    };

    synchronize = async function(payload: unknown): Promise<null> {
        const config = getConfig(payload);
        const state = getState(config.dialogKey);
        const event = config.event || "refresh";

        if (event === "init") {
            Object.assign(state, createInitialState());
            options.api.setValue?.(
                config.datasetContainer,
                options.api.listObjects?.("datasets") || []
            );
            options.setChecked(config.typeFuzzy, true);
            options.setChecked(config.shapeS, true);
            options.setChecked(config.directionInc, true);
            options.setChecked(config.newConditionCheckbox, false);
            options.setChecked(config.logisticCheckbox, true);
            options.setChecked(config.ecdfCheckbox, false);
            options.setChecked(config.findThresholdsCheckbox, false);
            options.setChecked(config.jitterCheckbox, false);
            options.api.setValue?.(config.thresholdCount, 1);
            options.api.setValue?.(config.idmInput, "0.95");
            options.api.setValue?.(config.aboveInput, "1");
            options.api.setValue?.(config.belowInput, "1");
            options.thresholds.resetState(config.stateKey);
            restoreThresholdValues(config);
            state.selectedDataset = firstSelected(
                options.api.getSelected?.(config.datasetContainer)
            );

            if (state.selectedDataset) {
                await populateVariables(config, state);
            } else {
                options.api.clearContent?.(config.variableContainer);
            }

            refresh(config, state);
            return null;
        }

        if (event === "dataset") {
            state.selectedDataset = firstSelected(
                options.api.getSelected?.(config.datasetContainer)
            );
            state.selectedVariable = "";
            state.variableValues = [];
            state.variableRowNames = [];
            state.variableValuesLoading = false;
            state.variableValuesError = "";
            state.variableValuesRequestKey = "";
            state.fuzzyPreviewValues = [];

            if (!state.selectedDataset) {
                options.api.clearContent?.(config.variableContainer);
                refresh(config, state);
                return null;
            }

            await populateVariables(config, state);

            if (state.selectedVariable) {
                await loadVariableValues(config, state);
            } else {
                refresh(config, state);
            }

            return null;
        }

        if (event === "variable") {
            state.selectedVariable = firstSelected(
                options.api.getSelected?.(config.variableContainer)
            );
            await loadVariableValues(config, state);
            return null;
        }

        if (["type", "shape", "direction", "logistic", "ecdf"].includes(event)) {
            saveThresholdValues(config);

            if (event === "shape" && options.api.isChecked?.(config.shapeBell)) {
                options.setChecked(config.logisticCheckbox, false);
                options.setChecked(config.ecdfCheckbox, false);
            }

            if (event === "logistic" && options.api.isChecked?.(config.logisticCheckbox)) {
                options.setChecked(config.shapeS, true);
                options.setChecked(config.ecdfCheckbox, false);
            }

            if (event === "ecdf" && options.api.isChecked?.(config.ecdfCheckbox)) {
                options.setChecked(config.shapeS, true);
                options.setChecked(config.logisticCheckbox, false);
            }

            restoreThresholdValues(config);

            if (
                options.api.isChecked?.(config.typeCrisp)
                && options.api.isChecked?.(config.findThresholdsCheckbox)
                && state.selectedDataset
                && state.selectedVariable
            ) {
                await requestCrispThresholds(config, state);
            } else if (canPreviewFuzzy(config, state)) {
                await requestFuzzyPreview(config, state);
            } else {
                state.fuzzyPreviewValues = [];
                refresh(config, state);
            }

            return null;
        }

        if (event === "thresholdCount") {
            const previousCount = state.lastVisibleThresholdCount;
            const nextCount = Math.max(
                1,
                Math.min(
                    config.thresholdInputs.length || 6,
                    Number(options.api.getValue?.(config.thresholdCount) || 1)
                )
            );

            options.api.setValue?.(config.thresholdCount, nextCount);

            if (
                options.api.isChecked?.(config.typeCrisp)
                && !options.api.isChecked?.(config.findThresholdsCheckbox)
                && nextCount > previousCount
            ) {
                for (let index = previousCount; index < nextCount; index += 1) {
                    options.api.setValue?.(config.thresholdInputs[index], "");
                }
            }

            saveThresholdValues(config);
            state.fuzzyPreviewValues = [];

            if (
                options.api.isChecked?.(config.typeCrisp)
                && options.api.isChecked?.(config.findThresholdsCheckbox)
                && state.selectedDataset
                && state.selectedVariable
            ) {
                await requestCrispThresholds(config, state);
            } else {
                refresh(config, state);
            }

            return null;
        }

        if (event === "findThresholds") {
            if (
                options.api.isChecked?.(config.findThresholdsCheckbox)
                && options.api.isChecked?.(config.typeCrisp)
                && state.selectedDataset
                && state.selectedVariable
            ) {
                await requestCrispThresholds(config, state);
            } else {
                refresh(config, state);
            }

            return null;
        }

        if (event === "thresholdInput") {
            if (state.suppressThresholdChange) {
                return null;
            }

            saveThresholdValues(config);

            if (canPreviewFuzzy(config, state)) {
                await requestFuzzyPreview(config, state);
            } else {
                state.fuzzyPreviewValues = [];
                refresh(config, state);
            }

            return null;
        }

        if (["idm", "above", "below"].includes(event)) {
            if (canPreviewFuzzy(config, state)) {
                await requestFuzzyPreview(config, state);
            } else {
                state.fuzzyPreviewValues = [];
                refresh(config, state);
            }

            return null;
        }

        const jitterEnabled = options.api.isChecked?.(config.jitterCheckbox) === true;

        if (jitterEnabled && !state.jitterEnabled) {
            rebuildJitter(state);
        }

        state.jitterEnabled = jitterEnabled;
        refresh(config, state);

        return null;
    };

    const validate = async function(payload: unknown): Promise<string> {
        const config = getConfig(payload);
        const state = getState(config.dialogKey);

        if (!state.selectedDataset) {
            options.api.addError?.(config.datasetContainer, "No dataset selected");
            return "";
        }

        if (!state.selectedVariable) {
            options.api.addError?.(config.variableContainer, "No condition selected");
            return "";
        }

        if (
            options.api.isChecked?.(config.newConditionCheckbox)
            && !asString(options.api.getValue?.(config.newConditionInput))
        ) {
            options.api.addError?.(
                config.newConditionInput,
                "New condition needs a name"
            );
            return "";
        }

        const spec = getThresholdSpec(config);

        if (spec.length < getVisibleThresholdCount(config)) {
            options.api.addError?.(
                config.plot,
                "All visible thresholds need numeric values"
            );
            return "";
        }

        if (spec.some((item) => item.numeric === null)) {
            options.api.addError?.(config.plot, "Thresholds must be numeric");
            return "";
        }

        if (
            !options.api.isChecked?.(config.typeCrisp)
            && options.api.isChecked?.(config.logisticCheckbox)
            && !Number.isFinite(
                Number(asString(options.api.getValue?.(config.idmInput)))
            )
        ) {
            options.api.addError?.(
                config.idmInput,
                "Degree of membership must be numeric"
            );
            return "";
        }

        const above = Number(asString(options.api.getValue?.(config.aboveInput)));
        const below = Number(asString(options.api.getValue?.(config.belowInput)));

        if (
            usesShapeForm(config)
            && (
                !Number.isFinite(above)
                || above <= 0
                || !Number.isFinite(below)
                || below <= 0
            )
        ) {
            options.api.addError?.(
                config.plot,
                "Shape form values must be positive"
            );
            return "";
        }

        return buildCommand(config, state);
    };

    return {
        renderPreview: previewRenderer.render,
        synchronize,
        validate
    };
};
