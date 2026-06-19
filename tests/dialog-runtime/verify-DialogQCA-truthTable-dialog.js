"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { createDialogControlModelFromSources, getDialogControl, setDialogControlSelected } = require(require("../dialogforge").dialogForgeModule("shared/dialog-runtime/custom-js/dialogControlModel"));
const { createDialogRuntimeHarness } = require(require("../dialogforge").dialogForgeModule("shared/dialog-runtime/custom-js/dialogRuntimeHarness"));
const { createDialogScriptRunner, listDialogScriptControlReferences } = require(require("../dialogforge").dialogForgeModule("shared/dialog-runtime/custom-js/dialogScriptRunner"));
const { createDialogExternalCallHost } = require(require("../dialogforge").dialogForgeModule("shared/dialog-runtime/custom-js/externalCallHost"));
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
const verifyTruthTableCommand = async function () {
    const source = JSON.parse(fs.readFileSync(path.join(rootDir, "dialogs/source/truthTable/dialog.json"), "utf8"));
    const commands = [];
    const model = createDialogControlModelFromSources(readDialogControls(source));
    const runner = createDialogScriptRunner({
        model,
        harness: createDialogRuntimeHarness({
            externalCallHost: createDialogExternalCallHost({
                datasets: [
                    { name: "qca_data", columns: ["A", "B", "OUT"] }
                ]
            })
        }),
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
    setDialogControlSelected(model, "c_datasets", ["qca_data"]);
    assert.strictEqual((await runner.trigger("change", "c_datasets")).status, "ready");
    assert.deepStrictEqual(getDialogControl(model, "c_outcome").value, ["A", "B", "OUT"]);
    assert.deepStrictEqual(getDialogControl(model, "c_conditions").value, ["A", "B", "OUT"]);
    setDialogControlSelected(model, "c_outcome", ["OUT"]);
    setDialogControlSelected(model, "c_conditions", ["A", "B"]);
    assert.strictEqual((await runner.trigger("change", "c_outcome")).status, "ready");
    assert.strictEqual((await runner.trigger("change", "c_conditions")).status, "ready");
    const syntax = String(getDialogControl(model, "__syntaxCommand").value || "");
    assert.ok(syntax.includes("truthTable(qca_data,"));
    assert.ok(syntax.includes("outcome = \"OUT\""));
    assert.ok(syntax.includes("conditions = \"A, B\""));
    assert.strictEqual((await runner.trigger("click", "b_run")).status, "ready");
    assert.strictEqual(commands.length, 1);
    assert.ok(commands[0].includes("truthTable(qca_data,"));
};
verifyTruthTableCommand()
    .then(() => {
    console.log("DialogQCA truth table source dialog verified.");
})
    .catch((error) => {
    console.error(error);
    process.exit(1);
});
