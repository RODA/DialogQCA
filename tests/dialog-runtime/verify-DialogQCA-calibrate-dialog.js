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
const verifyCalibratePreview = async function () {
    const source = JSON.parse(fs.readFileSync(path.join(rootDir, "dialogs/source/calibrate/dialog.json"), "utf8"));
    const commands = [];
    const model = createDialogControlModelFromSources(readDialogControls(source));
    const host = createCompositeDialogExternalCallHost({
        shared: createDialogExternalCallHost({
            datasets: [
                { name: "qca_data", columns: ["income", "OUT"] }
            ]
        }),
        products: {
            qca: createQcaExternalCallHost({
                listTruthTables: async function () {
                    return [];
                },
                getCalibrateThresholds: async function (request) {
                    assert.deepStrictEqual(request, {
                        dataset: "qca_data",
                        variable: "income",
                        thresholdCount: 3
                    });
                    return {
                        thresholds: [10, 20, 30]
                    };
                },
                getCalibratePreview: async function (request) {
                    assert.strictEqual(request.dataset, "qca_data");
                    assert.strictEqual(request.variable, "income");
                    assert.deepStrictEqual(request.thresholds, [10, 20, 30]);
                    assert.deepStrictEqual(request.thresholdNames, ["e", "c", "i"]);
                    assert.strictEqual(request.variant, "fuzzy");
                    return {
                        values: [0, 0.5, 1],
                        variable: "income"
                    };
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
        controlNames: listDialogScriptControlReferences(source.customJS),
        listObjects: function (kind) {
            return kind === "datasets" ? ["qca_data"] : [];
        },
        listColumns: function (objectName) {
            return objectName === "qca_data" ? ["income", "OUT"] : [];
        },
        enableSearch: function () {
            return undefined;
        },
        resetDialog: function () {
            return undefined;
        },
        runCommand: async function (command) {
            commands.push(String(command || ""));
            return { ok: true };
        }
    });
    const setup = await runner.run(source.customJS);
    assert.strictEqual(setup.status, "ready");
    await waitForDialogPromises();
    assert.deepStrictEqual(getDialogControl(model, "c_datasets").value, ["qca_data"]);
    setDialogControlSelected(model, "c_datasets", ["qca_data"]);
    assert.strictEqual((await runner.trigger("change", "c_datasets")).status, "ready");
    await waitForDialogPromises();
    assert.deepStrictEqual(getDialogControl(model, "c_variables").value, ["income", "OUT"]);
    setDialogControlSelected(model, "c_variables", ["income"]);
    setDialogControlChecked(model, "checkbox_findth", true);
    assert.strictEqual((await runner.trigger("change", "c_variables")).status, "ready");
    assert.strictEqual((await runner.trigger("change", "checkbox_findth")).status, "ready");
    await waitForDialogPromises();
    assert.strictEqual(getDialogControl(model, "l_th1").value, "e");
    assert.strictEqual(getDialogControl(model, "i_th1").value, "10");
    assert.strictEqual(getDialogControl(model, "i_th2").value, "20");
    assert.strictEqual(getDialogControl(model, "i_th3").value, "30");
    assert.strictEqual(getDialogControl(model, "cnt_nth").visible, false);
    assert.strictEqual(getDialogControl(model, "checkbox_findth").visible, true);
    assert.strictEqual(getDialogControl(model, "checkbox_findth").checked, true);
    assert.strictEqual(getDialogControl(model, "lbl_findth").visible, true);
    assert.strictEqual(getDialogControl(model, "checkbox_jitter").visible, true);
    assert.strictEqual(getDialogControl(model, "lbl_jitter").visible, true);
    assert.deepStrictEqual(getDialogControl(model, "plot_calibrate").plotPayload, {
        values: [0, 0.5, 1],
        variable: "income"
    });
    const syntax = String(getDialogControl(model, "__syntaxCommand").value || "");
    assert.ok(syntax.includes("inside(qca_data,"));
    assert.ok(syntax.includes("income <- calibrate(income,"));
    assert.ok(syntax.includes("thresholds = \"e=10, c=20, i=30\""));
    assert.strictEqual((await runner.trigger("click", "b_run")).status, "ready");
    assert.strictEqual(commands.length, 1);
    assert.strictEqual(commands[0], syntax);
    setDialogControlChecked(model, "checkbox_new_condition", true);
    assert.strictEqual((await runner.trigger("change", "checkbox_new_condition")).status, "ready");
    await waitForDialogPromises();
    assert.strictEqual(getDialogControl(model, "i_newvar").visible, true);
    assert.strictEqual(getDialogControl(model, "i_newvar").enabled, true);
    assert.strictEqual(String(getDialogControl(model, "__syntaxCommand").value || ""), "");
    setDialogControlValue(model, "i_newvar", "income_fz");
    assert.strictEqual((await runner.trigger("change", "i_newvar")).status, "ready");
    await waitForDialogPromises();
    const newConditionSyntax = String(getDialogControl(model, "__syntaxCommand").value || "");
    assert.ok(newConditionSyntax.includes("inside(qca_data,"));
    assert.ok(newConditionSyntax.includes("income_fz <- calibrate(income,"));
    assert.ok(newConditionSyntax.includes("thresholds = \"e=10, c=20, i=30\""));
    assert.strictEqual((await runner.trigger("click", "b_run")).status, "ready");
    assert.strictEqual(commands.length, 2);
    assert.strictEqual(commands[1], newConditionSyntax);
};
verifyCalibratePreview()
    .then(() => {
    console.log("DialogQCA calibrate source dialog verified.");
})
    .catch((error) => {
    console.error(error);
    process.exit(1);
});
