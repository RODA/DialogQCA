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
const createHarness = function (commands) {
    return createDialogRuntimeHarness({
        externalCallHost: createCompositeDialogExternalCallHost({
            shared: createDialogExternalCallHost({
                datasets: [
                    { name: "qca_data", columns: ["A", "B", "OUT"] }
                ]
            }),
            products: {
                qca: createQcaExternalCallHost({
                    listTruthTables: async function () {
                        return [
                            {
                                name: "tt_ready",
                                options: {
                                    outcome: "OUT",
                                    conditions: "A, B"
                                },
                                ids: ["1", "2"],
                                out: ["1", "0"],
                                cases: ["case1", "case2"]
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
        })
    });
};
const verifyMinimizeCommand = async function () {
    const source = JSON.parse(fs.readFileSync(path.join(rootDir, "dialogs/source/minimize/dialog.json"), "utf8"));
    const commands = [];
    const model = createDialogControlModelFromSources(readDialogControls(source));
    const runner = createDialogScriptRunner({
        model,
        harness: createHarness(commands),
        controlNames: listDialogScriptControlReferences(source.customJS),
        listObjects: function (kind) {
            return kind === "datasets" ? ["qca_data"] : [];
        },
        listColumns: function (objectName) {
            return objectName === "qca_data" ? ["A", "B", "OUT"] : [];
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
    assert.deepStrictEqual(getDialogControl(model, "c_datasets").value, ["tt_ready"]);
    assert.deepStrictEqual(getDialogControl(model, "c_datasets").selected, ["tt_ready"]);
    assert.deepStrictEqual(getDialogControl(model, "c_outcome").selected, ["OUT"]);
    assert.deepStrictEqual(getDialogControl(model, "c_conditions").selected, ["A", "B"]);
    assert.strictEqual(getDialogControl(model, "c_outcome").enabled, false);
    assert.strictEqual((await runner.trigger("click", "b_run")).status, "ready");
    assert.strictEqual(commands.length, 1);
    assert.ok(commands[0].includes("minimize(tt_ready"));
    setDialogControlChecked(model, "r_truthtable", false);
    setDialogControlChecked(model, "r_dataset", true);
    assert.strictEqual((await runner.trigger("change", "radiogroup1")).status, "ready");
    assert.deepStrictEqual(getDialogControl(model, "c_datasets").value, ["qca_data"]);
    assert.deepStrictEqual(getDialogControl(model, "c_datasets").selected, ["qca_data"]);
    assert.strictEqual(getDialogControl(model, "c_outcome").enabled, true);
    assert.deepStrictEqual(getDialogControl(model, "c_outcome").value, ["A", "B", "OUT"]);
    setDialogControlSelected(model, "c_outcome", ["OUT"]);
    setDialogControlSelected(model, "c_conditions", ["A", "B"]);
    assert.strictEqual((await runner.trigger("change", "c_outcome")).status, "ready");
    assert.strictEqual((await runner.trigger("change", "c_conditions")).status, "ready");
    setDialogControlSelected(model, "choice1", ["?"]);
    setDialogControlValue(model, "input4", "A*B");
    assert.strictEqual((await runner.trigger("change", "choice1")).status, "ready");
    assert.strictEqual((await runner.trigger("change", "input4")).status, "ready");
    const syntax = String(getDialogControl(model, "__syntaxCommand").value || "");
    assert.ok(syntax.includes("minimize(qca_data,"));
    assert.ok(syntax.includes("outcome = \"OUT\""));
    assert.ok(syntax.includes("conditions = \"A, B\""));
    assert.ok(syntax.includes("include = \"?\""));
    assert.ok(syntax.includes("dir.exp = \"A*B\""));
    assert.strictEqual((await runner.trigger("click", "b_run")).status, "ready");
    assert.strictEqual(commands.length, 2);
    assert.ok(commands[1].includes("minimize(qca_data,"));
};
verifyMinimizeCommand()
    .then(() => {
    console.log("DialogQCA minimize source dialog verified.");
})
    .catch((error) => {
    console.error(error);
    process.exit(1);
});
