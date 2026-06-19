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
const readDialogControls = function (source) {
    return (source.elements || []).map((element, index) => {
        return {
            id: element.id,
            name: element.nameid || element.name || element.id || "control_" + index,
            type: element.type,
            value: element.value || "",
            isSelected: element.isSelected,
            isEnabled: element.isEnabled,
            isVisible: element.isVisible
        };
    });
};
const waitForDialogPromises = function () {
    return new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
};
const verifyVennPreview = async function () {
    const source = JSON.parse(fs.readFileSync(path.join(rootDir, "dialogs/source/venn/dialog.json"), "utf8"));
    const model = createDialogControlModelFromSources(readDialogControls(source));
    const host = createCompositeDialogExternalCallHost({
        shared: createDialogExternalCallHost(),
        products: {
            qca: createQcaExternalCallHost({
                listTruthTables: async function () {
                    return [
                        {
                            name: "tt_old",
                            options: {
                                conditions: "A, B"
                            },
                            ids: ["00", "01", "10", "11"],
                            out: ["0", "0", "1", "1"],
                            cases: ["c1", "c2", "c3", "c4"]
                        },
                        {
                            name: "tt_new",
                            options: {
                                conditions: ["X", "Y"]
                            },
                            ids: ["00", "11"],
                            out: ["0", "1"],
                            cases: ["d1", "d2"]
                        }
                    ];
                },
                getCalibrateThresholds: async function () {
                    return {};
                },
                getCalibratePreview: async function () {
                    return {};
                },
                getXYPlotPreview: async function () {
                    return {};
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
        controlNames: listDialogScriptControlReferences(source.customJS)
    });
    const setup = await runner.run(source.customJS);
    assert.strictEqual(setup.status, "ready");
    await waitForDialogPromises();
    assert.deepStrictEqual(getDialogControl(model, "select1").value, ["tt_old", "tt_new"]);
    assert.deepStrictEqual(getDialogControl(model, "select1").selected, ["tt_new"]);
    assert.deepStrictEqual(getDialogControl(model, "plot_venn").plotPayload, {
        conditions: ["X", "Y"],
        ids: ["00", "11"],
        out: ["0", "1"],
        cases: ["d1", "d2"],
        showCustom: false,
        customText: ""
    });
    setDialogControlSelected(model, "select1", ["tt_old"]);
    assert.strictEqual((await runner.trigger("change", "select1")).status, "ready");
    await waitForDialogPromises();
    assert.deepStrictEqual(getDialogControl(model, "plot_venn").plotPayload.conditions, ["A", "B"]);
    setDialogControlChecked(model, "custom", true);
    setDialogControlValue(model, "input1", "A*B");
    assert.strictEqual((await runner.trigger("click", "custom")).status, "ready");
    assert.strictEqual((await runner.trigger("input", "input1")).status, "ready");
    await waitForDialogPromises();
    assert.strictEqual(getDialogControl(model, "input1").visible, true);
    assert.deepStrictEqual(getDialogControl(model, "plot_venn").plotPayload, {
        conditions: ["A", "B"],
        ids: ["00", "01", "10", "11"],
        out: ["0", "0", "1", "1"],
        cases: ["c1", "c2", "c3", "c4"],
        showCustom: true,
        customText: "A*B"
    });
    setDialogControlChecked(model, "custom", false);
    assert.strictEqual((await runner.trigger("click", "custom")).status, "ready");
    await waitForDialogPromises();
    assert.strictEqual(getDialogControl(model, "input1").visible, false);
    assert.deepStrictEqual(getDialogControl(model, "plot_venn").plotPayload, {
        conditions: ["A", "B"],
        ids: ["00", "01", "10", "11"],
        out: ["0", "0", "1", "1"],
        cases: ["c1", "c2", "c3", "c4"],
        showCustom: false,
        customText: "A*B"
    });
};
verifyVennPreview()
    .then(() => {
    console.log("DialogQCA Venn source dialog verified.");
})
    .catch((error) => {
    console.error(error);
    process.exit(1);
});
