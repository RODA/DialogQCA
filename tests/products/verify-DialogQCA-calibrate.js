"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const { buildQcaCalibrateCommand, createQcaCalibrateDialogState, getQcaCalibrateThresholdNames, getQcaCalibrateVisibleThresholdCount, validateQcaCalibrateDialog, withQcaCalibrateRuntimePayloads } = require("../../qca/qcaCalibrateDialog");
assert.strictEqual(getQcaCalibrateVisibleThresholdCount({
    type: "crisp",
    thresholdCount: 8
}), 6);
assert.deepStrictEqual(getQcaCalibrateThresholdNames({
    type: "fuzzy",
    bell: true,
    increasing: false
}), ["i1", "c1", "e1", "e2", "c2", "i2"]);
assert.strictEqual(buildQcaCalibrateCommand({
    selectedDataset: "survey",
    selectedVariable: "income",
    type: "crisp",
    thresholdCount: 2,
    thresholdValues: ["10", "20"]
}), [
    "inside(survey,",
    "  income <- calibrate(income,",
    "     type = \"crisp\",",
    "     thresholds = c(10, 20)",
    "  )",
    ")"
].join("\n"));
assert.strictEqual(buildQcaCalibrateCommand({
    selectedDataset: "survey",
    selectedVariable: "income",
    useNewCondition: true,
    newConditionName: "income_fz",
    type: "fuzzy",
    thresholdValues: ["10", "20", "30"],
    logistic: false,
    ecdf: true,
    above: 1,
    below: 1
}), [
    "inside(survey,",
    "  income_fz <- calibrate(income,",
    "     thresholds = \"e=10, c=20, i=30\",",
    "     logistic = FALSE, ecdf = TRUE",
    "  )",
    ")"
].join("\n"));
assert.deepStrictEqual(validateQcaCalibrateDialog({
    selectedDataset: "survey",
    selectedVariable: "income",
    useNewCondition: true,
    newConditionName: "",
    type: "fuzzy",
    thresholdValues: ["10", "20"],
    above: 0,
    below: 1
}), {
    status: "invalid",
    command: "",
    errors: [
        "New condition needs a name",
        "All visible thresholds need numeric values",
        "Shape form values must be positive"
    ]
});
assert.strictEqual(validateQcaCalibrateDialog({
    selectedDataset: "survey",
    selectedVariable: "income",
    type: "fuzzy",
    thresholdValues: ["10", "20", "30"],
    logistic: true,
    idm: "0.8"
}).command, [
    "inside(survey,",
    "  income <- calibrate(income,",
    "     thresholds = \"e=10, c=20, i=30\",",
    "     idm = 0.8",
    "  )",
    ")"
].join("\n"));
const viewState = createQcaCalibrateDialogState({
    datasetContainer: "c_datasets",
    variableContainer: "c_variables",
    typeCrisp: "r_type_crisp",
    typeFuzzy: "r_type_fuzzy",
    shapeBell: "r_shape_bell",
    shapeS: "r_shape_s",
    directionInc: "r_dir_inc",
    directionDec: "r_dir_dec",
    thresholdCount: "cnt_nth",
    thresholdInputs: ["i_th1", "i_th2", "i_th3"],
    thresholdLabels: ["l_th1", "l_th2", "l_th3"],
    findThresholdsCheckbox: "checkbox_findth",
    logisticCheckbox: "checkbox_logistic",
    ecdfCheckbox: "checkbox_ecdf",
    jitterCheckbox: "checkbox_jitter",
    newConditionCheckbox: "checkbox_new_condition",
    newConditionInput: "i_newvar",
    idmInput: "i_idm",
    aboveInput: "i_above",
    belowInput: "i_below",
    plot: "plot_calibrate",
    __controlSnapshot: {
        c_datasets: { selected: ["survey"] },
        c_variables: { selected: ["income"] },
        r_type_fuzzy: { checked: true },
        r_dir_inc: { checked: true },
        checkbox_findth: { checked: true },
        checkbox_logistic: { checked: true },
        checkbox_jitter: { checked: true },
        cnt_nth: { value: "3" },
        i_th1: { value: "10" },
        i_th2: { value: "20" },
        i_th3: { value: "30" },
        i_idm: { value: "0.8" },
        i_above: { value: "1" },
        i_below: { value: "1" }
    }
});
assert.strictEqual(viewState.state.selectedDataset, "survey");
assert.strictEqual(viewState.state.selectedVariable, "income");
assert.strictEqual(viewState.state.findThresholds, true);
assert.strictEqual(viewState.state.jitter, true);
assert.strictEqual(viewState.visibleThresholdCount, 3);
assert.deepStrictEqual(viewState.thresholdNames, ["e", "c", "i"]);
assert.strictEqual(viewState.validation.status, "ready");
assert.deepStrictEqual(withQcaCalibrateRuntimePayloads(viewState, {
    thresholds: [0.25, 0.5, 0.75]
}, {
    values: [0, 1]
}).thresholdValues, ["0.25", "0.5", "0.75"]);
console.log("DialogQCA calibrate dialog helpers verified.");
