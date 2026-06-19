"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const { buildQcaXYPlotFitLabels, buildQcaXYPlotPoints, createQcaXYPlotDialogState } = require("../../qca/qcaXYPlotDialog");
const plotData = {
    x: { a: 0.1, b: 0.9, c: "bad" },
    y: [0.2, 0.8, 0.7],
    labels: ["case1", "case2", "case3"],
    sufficiency: [
        ["0.91", "0.82", "0.77"],
        ["0.61", "0.52", "0.47"],
        ["0.41", "0.32", "0.27"],
        ["0.21", "0.12", "0.07"]
    ],
    necessity: [
        ["0.11", "0.22", "0.33"],
        ["0.44", "0.55", "0.66"],
        ["0.77", "0.88", "0.99"],
        ["0.10", "0.20", "0.30"]
    ]
};
assert.deepStrictEqual(buildQcaXYPlotPoints(plotData), [
    { x: 0.1, y: 0.2, label: "case1" },
    { x: 0.9, y: 0.8, label: "case2" }
]);
assert.deepStrictEqual(buildQcaXYPlotFitLabels({
    plotData,
    showParametersOfFit: true,
    necessity: false,
    negateX: true,
    negateY: false
}), ["Inclusion: 0.61", "Coverage: 0.52", "PRI: 0.47"]);
assert.deepStrictEqual(buildQcaXYPlotFitLabels({
    plotData,
    showParametersOfFit: true,
    necessity: true,
    negateX: true,
    negateY: true
}), ["Inclusion: 0.10", "Coverage: 0.20", "Relevance: 0.30"]);
assert.deepStrictEqual(createQcaXYPlotDialogState({
    selectedDataset: "data",
    selectedX: "xcond",
    selectedY: "ycond",
    plotData,
    showParametersOfFit: true
}), {
    selectedDataset: "data",
    selectedX: "xcond",
    selectedY: "ycond",
    xAxisLabel: "XCOND",
    yAxisLabel: "YCOND",
    points: [
        { x: 0.1, y: 0.2, label: "case1" },
        { x: 0.9, y: 0.8, label: "case2" }
    ],
    fitLabels: ["Inclusion: 0.91", "Coverage: 0.82", "PRI: 0.77"],
    showGuides: true,
    showCases: false,
    fillPoints: true,
    jitterPoints: false,
    caseLabelRotation: 0
});
assert.strictEqual(createQcaXYPlotDialogState({
    plotData,
    showGuides: false
}).showGuides, false);
assert.strictEqual(createQcaXYPlotDialogState({
    plotData,
    showCases: true
}).showCases, true);
assert.strictEqual(createQcaXYPlotDialogState({
    plotData,
    fillPoints: false
}).fillPoints, false);
assert.strictEqual(createQcaXYPlotDialogState({
    plotData,
    jitterPoints: true
}).jitterPoints, true);
assert.strictEqual(createQcaXYPlotDialogState({
    plotData,
    caseLabelRotation: 2
}).caseLabelRotation, 90);
assert.deepStrictEqual(createQcaXYPlotDialogState({
    plotData,
    negateX: true,
    negateY: true
}).points, [
    { x: 0.9, y: 0.8, label: "case1" },
    { x: 0.1, y: 0.2, label: "case2" }
]);
console.log("DialogQCA XY plot dialog helpers verified.");
