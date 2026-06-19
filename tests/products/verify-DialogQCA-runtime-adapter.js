"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const { createDialogControlModel, getDialogControl } = require(require("../dialogforge").dialogForgeModule("shared/dialog-runtime/custom-js/dialogControlModel"));
const { applyQcaExternalCallResultToControls } = require("../../qca/qcaDialogRuntimeAdapter");
const model = createDialogControlModel();
assert.strictEqual(applyQcaExternalCallResultToControls(model, "qca.syncCalibrateDialog", {}, {
    controls: {
        typeCrisp: "r_type_crisp",
        typeFuzzy: "r_type_fuzzy",
        shapeBell: "r_shape_bell",
        shapeS: "r_shape_s",
        directionInc: "r_dir_inc",
        directionDec: "r_dir_dec",
        thresholdCount: "cnt_nth",
        thresholdInputs: ["i_th1", "i_th2", "i_th3"],
        thresholdLabels: ["l_th1", "l_th2", "l_th3"],
        newConditionCheckbox: "checkbox_new_condition",
        newConditionInput: "i_newvar",
        findThresholdsCheckbox: "checkbox_findth",
        logisticCheckbox: "checkbox_logistic",
        ecdfCheckbox: "checkbox_ecdf",
        jitterCheckbox: "checkbox_jitter",
        idmInput: "i_idm",
        aboveInput: "i_above",
        belowInput: "i_below",
        plot: "plot_calibrate",
        shapeLabel: "lbl_shape",
        shapeSLabel: "lbl_shape_s",
        shapeBellLabel: "lbl_shape_bell",
        directionLabel: "lbl_direction",
        directionIncLabel: "lbl_dir_inc",
        directionDecLabel: "lbl_dir_dec",
        thresholdCountLabel: "lbl_nth",
        findThresholdsLabel: "lbl_findth",
        jitterLabel: "lbl_jitter",
        logisticLabel: "lbl_logistic",
        ecdfLabel: "lbl_ecdf",
        idmLabel: "lbl_idm",
        shapeFormLabel: "lbl_shape_form",
        aboveLabel: "lbl_above",
        belowLabel: "lbl_below"
    },
    state: {
        type: "fuzzy",
        crisp: false,
        bell: false,
        increasing: true,
        logistic: true,
        ecdf: false,
        findThresholds: true,
        jitter: true,
        useNewCondition: true
    },
    thresholdNames: ["e", "c", "i"],
    visibleThresholdCount: 3,
    thresholdValues: ["10", "20", "30"],
    previewPayload: {
        values: [0, 1]
    },
    validation: {
        status: "ready",
        command: "inside(survey, x <- calibrate(x))",
        errors: []
    }
}), true);
assert.strictEqual(getDialogControl(model, "r_type_fuzzy").checked, true);
assert.strictEqual(getDialogControl(model, "i_newvar").visible, true);
assert.strictEqual(getDialogControl(model, "cnt_nth").visible, false);
assert.strictEqual(getDialogControl(model, "checkbox_findth").visible, true);
assert.strictEqual(getDialogControl(model, "checkbox_findth").checked, true);
assert.strictEqual(getDialogControl(model, "checkbox_jitter").visible, true);
assert.strictEqual(getDialogControl(model, "checkbox_jitter").checked, true);
assert.strictEqual(getDialogControl(model, "l_th1").value, "e");
assert.strictEqual(getDialogControl(model, "i_th3").value, "30");
assert.deepStrictEqual(getDialogControl(model, "plot_calibrate").plotPayload, {
    values: [0, 1]
});
assert.strictEqual(getDialogControl(model, "__syntaxCommand").value, "inside(survey, x <- calibrate(x))");
assert.strictEqual(applyQcaExternalCallResultToControls(model, "qca.syncVennDialog", {
    truthTableSelect: "select1",
    customInput: "input1",
    target: "plot_venn"
}, {
    truthTableNames: ["tt1"],
    selectedTruthTable: "tt1",
    renderPayload: {
        conditions: ["A"],
        ids: ["1", "0"],
        out: ["1", "0"],
        cases: ["case1", "case2"],
        showCustom: false,
        customText: ""
    }
}), true);
assert.deepStrictEqual(getDialogControl(model, "select1").selected, ["tt1"]);
assert.deepStrictEqual(getDialogControl(model, "plot_venn").plotPayload, {
    conditions: ["A"],
    ids: ["1", "0"],
    out: ["1", "0"],
    cases: ["case1", "case2"],
    showCustom: false,
    customText: ""
});
assert.strictEqual(applyQcaExternalCallResultToControls(model, "qca.syncXYPlotDialog", {
    rotateInput: "rotate",
    rotateLabel: "rotate_label",
    xAxisLabel: "xaxis_label",
    yAxisLabel: "yaxis_label",
    measureLabels: ["incl_label", "cov_label", "pri_label"],
    measureValues: ["incl_value", "cov_value", "pri_value"],
    separators: ["separator1", "separator2"],
    plot: "plot_xy"
}, {
    selectedDataset: "survey",
    selectedX: "A",
    selectedY: "B",
    xAxisLabel: "A",
    yAxisLabel: "B",
    points: [
        { x: 0.1, y: 0.2, label: "case1" }
    ],
    fitLabels: ["Inclusion: 0.9", "Coverage: 0.8", "PRI: 0.7"],
    showGuides: false,
    showCases: true,
    fillPoints: false,
    jitterPoints: true,
    caseLabelRotation: 90
}), true);
assert.strictEqual(getDialogControl(model, "xaxis_label").value, "A");
assert.strictEqual(getDialogControl(model, "pri_label").value, "PRI:");
assert.strictEqual(getDialogControl(model, "pri_value").value, "0.7");
assert.strictEqual(getDialogControl(model, "separator1").visible, true);
assert.strictEqual(getDialogControl(model, "plot_xy").plotPayload.showCases, true);
assert.strictEqual(getDialogControl(model, "plot_xy").plotPayload.fillPoints, false);
assert.strictEqual(getDialogControl(model, "plot_xy").plotPayload.showGuides, false);
assert.strictEqual(getDialogControl(model, "plot_xy").plotPayload.jitterPoints, true);
assert.strictEqual(getDialogControl(model, "rotate").visible, true);
assert.strictEqual(getDialogControl(model, "plot_xy").plotPayload.caseLabelRotation, 90);
assert.strictEqual(applyQcaExternalCallResultToControls(model, "qca.missing", {}, null), false);
console.log("DialogQCA dialog runtime adapter verified.");
