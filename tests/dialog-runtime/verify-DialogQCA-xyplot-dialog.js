"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { createDialogControlModelFromSources, getDialogControl, setDialogControlChecked, setDialogControlSelected, setDialogControlValue } = require(require("../dialogforge").dialogForgeModule("shared/dialog-runtime/custom-js/dialogControlModel"));
const { createDialogRuntimeHarness } = require(require("../dialogforge").dialogForgeModule("shared/dialog-runtime/custom-js/dialogRuntimeHarness"));
const { createDialogScriptRunner, listDialogScriptControlReferences } = require(require("../dialogforge").dialogForgeModule("shared/dialog-runtime/custom-js/dialogScriptRunner"));
const { createCompositeDialogExternalCallHost } = require(require("../dialogforge").dialogForgeModule("shared/dialog-runtime/custom-js/compositeExternalCallHost"));
const { createDialogExternalCallHost } = require(require("../dialogforge").dialogForgeModule("shared/dialog-runtime/custom-js/externalCallHost"));
const { createQcaExternalCallHost } = require("../../qca/qcaExternalCallHost");
const { applyQcaExternalCallResultToControls } = require("../../qca/qcaDialogRuntimeAdapter");
const rootDir = path.resolve(__dirname, "../..");
const waitForDialogPromises = function () {
    return new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
};
const readDialogControls = function (source) {
    return (source.elements || []).map((element, index) => {
        return {
            id: element.id,
            name: element.nameid || element.name || element.id || "control_" + index,
            type: element.type,
            value: element.value || "",
            isSelected: element.isSelected,
            checked: element.isChecked,
            isEnabled: element.isEnabled,
            isVisible: element.isVisible
        };
    });
};
const verifyXYPlotPreview = async function () {
    const source = JSON.parse(fs.readFileSync(path.join(rootDir, "dialogs/source/xyplot/dialog.json"), "utf8"));
    const model = createDialogControlModelFromSources(readDialogControls(source));
    const host = createCompositeDialogExternalCallHost({
        shared: createDialogExternalCallHost({
            datasets: [
                { name: "qca_data", columns: ["A", "B", "OUT"] }
            ]
        }),
        products: {
            qca: createQcaExternalCallHost({
                listTruthTables: async function () {
                    return [];
                },
                getCalibrateThresholds: async function () {
                    return {};
                },
                getCalibratePreview: async function () {
                    return {};
                },
                getXYPlotPreview: async function (request) {
                    assert.deepStrictEqual(request, {
                        dataset: "qca_data",
                        xVariable: "A",
                        yVariable: "OUT"
                    });
                    return {
                        x: [0, 1],
                        y: [0.25, 0.75],
                        labels: ["case1", "case2"],
                        sufficiency: [
                            ["0.91", "0.82", "0.73"],
                            ["0.61", "0.52", "0.43"],
                            ["0.31", "0.22", "0.13"],
                            ["0.21", "0.12", "0.03"]
                        ],
                        necessity: [
                            ["0.11", "0.22", "0.33"],
                            ["0.44", "0.55", "0.66"],
                            ["0.77", "0.88", "0.99"],
                            ["0.10", "0.20", "0.30"]
                        ]
                    };
                }
            })
        }
    });
    const runner = createDialogScriptRunner({
        model,
        harness: createDialogRuntimeHarness({
            externalCallHost: host
        }),
        afterExternalCall: async function (name, parameters, value) {
            applyQcaExternalCallResultToControls(model, name, parameters, value);
        },
        controlNames: listDialogScriptControlReferences(source.customJS),
        listObjects: function (kind) {
            return kind === "datasets" ? ["qca_data"] : [];
        },
        listColumns: function (objectName) {
            return objectName === "qca_data" ? ["A", "B", "OUT"] : [];
        },
        enableSearch: function () {
            return undefined;
        }
    });
    const setup = await runner.run(source.customJS);
    assert.strictEqual(setup.status, "ready");
    assert.deepStrictEqual(getDialogControl(model, "c_datasets").value, ["qca_data"]);
    setDialogControlSelected(model, "c_datasets", ["qca_data"]);
    assert.strictEqual((await runner.trigger("change", "c_datasets")).status, "ready");
    assert.deepStrictEqual(getDialogControl(model, "c_x").value, ["A", "B", "OUT"]);
    assert.deepStrictEqual(getDialogControl(model, "c_y").value, ["A", "B", "OUT"]);
    setDialogControlSelected(model, "c_x", ["A"]);
    setDialogControlSelected(model, "c_y", ["OUT"]);
    setDialogControlChecked(model, "pof", true);
    assert.strictEqual((await runner.trigger("change", "c_x")).status, "ready");
    assert.strictEqual((await runner.trigger("change", "c_y")).status, "ready");
    assert.strictEqual((await runner.trigger("change", "pof")).status, "ready");
    await waitForDialogPromises();
    assert.strictEqual(getDialogControl(model, "xaxis_label").value, "A");
    assert.strictEqual(getDialogControl(model, "yaxis_label").value, "OUT");
    assert.strictEqual(getDialogControl(model, "label15").value, "Inclusion:");
    assert.strictEqual(getDialogControl(model, "incl_value").value, "0.91");
    assert.strictEqual(getDialogControl(model, "label19").value, "PRI:");
    assert.strictEqual(getDialogControl(model, "pri_value").value, "0.73");
    assert.strictEqual(getDialogControl(model, "separator1").visible, true);
    assert.deepStrictEqual(getDialogControl(model, "plot_xy").plotPayload, {
        points: [
            { x: 0, y: 0.25, label: "case1" },
            { x: 1, y: 0.75, label: "case2" }
        ],
        xAxisLabel: "A",
        yAxisLabel: "OUT",
        fitLabels: [
            "Inclusion: 0.91",
            "Coverage: 0.82",
            "PRI: 0.73"
        ],
        showGuides: true,
        showCases: false,
        fillPoints: true,
        jitterPoints: false,
        caseLabelRotation: 0
    });
    setDialogControlChecked(model, "guides", false);
    assert.strictEqual((await runner.trigger("change", "guides")).status, "ready");
    await waitForDialogPromises();
    assert.strictEqual(getDialogControl(model, "plot_xy").plotPayload.showGuides, false);
    setDialogControlChecked(model, "neg_x", true);
    assert.strictEqual((await runner.trigger("change", "neg_x")).status, "ready");
    await waitForDialogPromises();
    assert.deepStrictEqual(getDialogControl(model, "plot_xy").plotPayload.points[0], {
        x: 1,
        y: 0.25,
        label: "case1"
    });
    setDialogControlChecked(model, "cases", true);
    assert.strictEqual((await runner.trigger("change", "cases")).status, "ready");
    await waitForDialogPromises();
    assert.strictEqual(getDialogControl(model, "plot_xy").plotPayload.showCases, true);
    assert.strictEqual(getDialogControl(model, "rotate").visible, true);
    setDialogControlValue(model, "rotate", "2");
    assert.strictEqual((await runner.trigger("change", "rotate")).status, "ready");
    await waitForDialogPromises();
    assert.strictEqual(getDialogControl(model, "plot_xy").plotPayload.caseLabelRotation, 90);
    setDialogControlChecked(model, "fill", false);
    assert.strictEqual((await runner.trigger("change", "fill")).status, "ready");
    await waitForDialogPromises();
    assert.strictEqual(getDialogControl(model, "plot_xy").plotPayload.fillPoints, false);
    setDialogControlChecked(model, "jitter", true);
    assert.strictEqual((await runner.trigger("change", "jitter")).status, "ready");
    await waitForDialogPromises();
    assert.strictEqual(getDialogControl(model, "plot_xy").plotPayload.jitterPoints, true);
    setDialogControlChecked(model, "r_suf", false);
    setDialogControlChecked(model, "r_nec", true);
    setDialogControlChecked(model, "neg_y", true);
    assert.strictEqual((await runner.trigger("change", "radiogroup1")).status, "ready");
    assert.strictEqual((await runner.trigger("change", "neg_y")).status, "ready");
    await waitForDialogPromises();
    assert.strictEqual(getDialogControl(model, "label15").value, "Inclusion:");
    assert.strictEqual(getDialogControl(model, "incl_value").value, "0.10");
    assert.strictEqual(getDialogControl(model, "label17").value, "Coverage:");
    assert.strictEqual(getDialogControl(model, "cov_value").value, "0.20");
    assert.strictEqual(getDialogControl(model, "label19").value, "Relevance:");
    assert.strictEqual(getDialogControl(model, "pri_value").value, "0.30");
    assert.deepStrictEqual(getDialogControl(model, "plot_xy").plotPayload.points[0], {
        x: 1,
        y: 0.75,
        label: "case1"
    });
    assert.deepStrictEqual(getDialogControl(model, "plot_xy").plotPayload.fitLabels, [
        "Inclusion: 0.10",
        "Coverage: 0.20",
        "Relevance: 0.30"
    ]);
};
verifyXYPlotPreview()
    .then(() => {
    console.log("DialogQCA XY plot source dialog verified.");
})
    .catch((error) => {
    console.error(error);
    process.exit(1);
});
