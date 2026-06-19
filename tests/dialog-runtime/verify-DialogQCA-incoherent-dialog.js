"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { createDialogControlModelFromSources, getDialogControl, setDialogControlChecked, setDialogControlSelected, setDialogControlValue } = require(require("../dialogforge").dialogForgeModule("shared/dialog-runtime/custom-js/dialogControlModel"));
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
            checked: element.isChecked,
            isSelected: element.isSelected,
            isEnabled: element.isEnabled,
            isVisible: element.isVisible
        };
    });
};
const verifyIncoherentCommand = async function () {
    const source = JSON.parse(fs.readFileSync(path.join(rootDir, "dialogs/source/incoherent/dialog.json"), "utf8"));
    const commands = [];
    const model = createDialogControlModelFromSources(readDialogControls(source));
    const runner = createDialogScriptRunner({
        model,
        harness: createDialogRuntimeHarness({
            externalCallHost: createDialogExternalCallHost()
        }),
        controlNames: listDialogScriptControlReferences(source.customJS),
        listObjects: function (kind) {
            return kind === "truthtables" ? ["tt1"] : [];
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
    assert.deepStrictEqual(getDialogControl(model, "c_datasets").value, ["tt1"]);
    assert.strictEqual(getDialogControl(model, "subsets").checked, true);
    setDialogControlSelected(model, "c_datasets", ["tt1"]);
    assert.strictEqual((await runner.trigger("change", "c_datasets")).status, "ready");
    assert.strictEqual((await runner.trigger("click", "b_run")).status, "ready");
    assert.deepStrictEqual(getDialogControl(model, "expressions_input").errors, ["Expression needed"]);
    setDialogControlValue(model, "expressions_input", "A*B");
    assert.strictEqual((await runner.trigger("change", "expressions_input")).status, "ready");
    let syntax = String(getDialogControl(model, "__syntaxCommand").value || "");
    assert.strictEqual(syntax, "findRows(obj = tt1, expression = \"A*B\", type = 1)\n");
    assert.strictEqual((await runner.trigger("click", "b_run")).status, "ready");
    assert.strictEqual(commands[0], syntax);
    setDialogControlChecked(model, "assign", true);
    setDialogControlValue(model, "object_name", "1 bad-name!");
    assert.strictEqual((await runner.trigger("change", "assign")).status, "ready");
    assert.strictEqual((await runner.trigger("change", "object_name")).status, "ready");
    assert.strictEqual(getDialogControl(model, "object_name").value, "x1badname");
    assert.strictEqual(getDialogControl(model, "object_name").visible, true);
    assert.ok(String(getDialogControl(model, "__syntaxCommand").value || "").startsWith("x1badname <- findRows("));
    setDialogControlChecked(model, "select_all", true);
    assert.strictEqual((await runner.trigger("change", "select_all")).status, "ready");
    assert.strictEqual(getDialogControl(model, "csa").checked, true);
    assert.strictEqual(getDialogControl(model, "ssr").checked, true);
    syntax = String(getDialogControl(model, "__syntaxCommand").value || "");
    assert.ok(syntax.includes("type = 0"));
};
verifyIncoherentCommand()
    .then(() => {
    console.log("DialogQCA incoherent source dialog verified.");
})
    .catch((error) => {
    console.error(error);
    process.exit(1);
});
