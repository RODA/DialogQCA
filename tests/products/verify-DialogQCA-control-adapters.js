"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const { createDialogControlModel, createDialogControlModelFromSources, getDialogControl } = require(require("../dialogforge").dialogForgeModule("shared/dialog-runtime/custom-js/dialogControlModel"));
const { applyQcaVennDialogState, applyQcaXYPlotDialogState } = require("../../qca/qcaDialogControlAdapters");
const model = createDialogControlModel();
const sourceModel = createDialogControlModelFromSources([
    {
        id: "checkbox-id",
        name: "custom",
        type: "Checkbox",
        value: "checked"
    },
    {
        id: "input-id",
        name: "input1",
        type: "Input",
        value: "A*B"
    }
]);
assert.strictEqual(getDialogControl(sourceModel, "custom").checked, true);
assert.strictEqual(getDialogControl(sourceModel, "input1").value, "A*B");
applyQcaVennDialogState(model, {
    truthTableSelect: "select1",
    customInput: "input1",
    plot: "plot_venn"
}, {
    truthTableNames: ["tt1", "tt2"],
    selectedTruthTable: "tt2",
    renderPayload: {
        conditions: ["A", "B"],
        ids: ["12"],
        out: ["1"],
        cases: ["case1"],
        showCustom: true,
        customText: "A*B"
    }
});
assert.deepStrictEqual(getDialogControl(model, "select1").value, ["tt1", "tt2"]);
assert.deepStrictEqual(getDialogControl(model, "select1").selected, ["tt2"]);
assert.strictEqual(getDialogControl(model, "input1").visible, true);
assert.deepStrictEqual(getDialogControl(model, "plot_venn").plotPayload, {
    conditions: ["A", "B"],
    ids: ["12"],
    out: ["1"],
    cases: ["case1"],
    showCustom: true,
    customText: "A*B"
});
applyQcaXYPlotDialogState(model, {
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
    showGuides: true,
    showCases: false,
    fillPoints: true,
    jitterPoints: false,
    caseLabelRotation: 0
});
assert.strictEqual(getDialogControl(model, "xaxis_label").value, "A");
assert.strictEqual(getDialogControl(model, "yaxis_label").value, "B");
assert.strictEqual(getDialogControl(model, "incl_label").visible, true);
assert.strictEqual(getDialogControl(model, "incl_label").value, "Inclusion:");
assert.strictEqual(getDialogControl(model, "incl_value").visible, true);
assert.strictEqual(getDialogControl(model, "incl_value").value, "0.9");
assert.strictEqual(getDialogControl(model, "separator1").visible, true);
assert.strictEqual(getDialogControl(model, "rotate").visible, false);
assert.deepStrictEqual(getDialogControl(model, "plot_xy").plotPayload, {
    points: [
        { x: 0.1, y: 0.2, label: "case1" }
    ],
    xAxisLabel: "A",
    yAxisLabel: "B",
    fitLabels: ["Inclusion: 0.9", "Coverage: 0.8", "PRI: 0.7"],
    showGuides: true,
    showCases: false,
    fillPoints: true,
    jitterPoints: false,
    caseLabelRotation: 0
});
applyQcaXYPlotDialogState(model, {
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
    points: [],
    fitLabels: [],
    showGuides: false,
    showCases: true,
    fillPoints: true,
    jitterPoints: true,
    caseLabelRotation: 90
});
assert.strictEqual(getDialogControl(model, "incl_label").visible, false);
assert.strictEqual(getDialogControl(model, "incl_value").visible, false);
assert.strictEqual(getDialogControl(model, "separator1").visible, false);
assert.strictEqual(getDialogControl(model, "rotate").visible, true);
assert.strictEqual(getDialogControl(model, "rotate_label").visible, true);
assert.strictEqual(getDialogControl(model, "plot_xy").plotPayload.caseLabelRotation, 90);
console.log("DialogQCA dialog control adapters verified.");
