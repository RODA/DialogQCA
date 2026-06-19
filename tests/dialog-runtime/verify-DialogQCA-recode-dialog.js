"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { createDialogControlModelFromSources, getDialogControl, setDialogControlSelected, setDialogControlValue } = require(require("../dialogforge").dialogForgeModule("shared/dialog-runtime/custom-js/dialogControlModel"));
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
const verifyRecodeRuleEditing = async function () {
    const source = JSON.parse(fs.readFileSync(path.join(rootDir, "dialogs/source/recode/dialog.json"), "utf8"));
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
        }
    });
    const setup = await runner.run(source.customJS);
    assert.strictEqual(setup.status, "ready");
    setDialogControlSelected(model, "c_datasets", ["qca_data"]);
    assert.strictEqual((await runner.trigger("change", "c_datasets")).status, "ready");
    assert.deepStrictEqual(getDialogControl(model, "c_conditions").value, ["A", "B", "OUT"]);
    setDialogControlSelected(model, "c_conditions", ["A"]);
    assert.strictEqual((await runner.trigger("change", "c_conditions")).status, "ready");
    setDialogControlValue(model, "i_value_old", "0");
    assert.strictEqual((await runner.trigger("change", "i_value_old")).status, "ready");
    setDialogControlValue(model, "i_value_new", "1");
    assert.strictEqual((await runner.trigger("change", "i_value_new")).status, "ready");
    assert.strictEqual((await runner.trigger("click", "b_add")).status, "ready");
    assert.deepStrictEqual(getDialogControl(model, "c_rules").value, ["0=1"]);
    assert.ok(String(getDialogControl(model, "__syntaxCommand").value).includes("rules = \"0=1\""));
    setDialogControlSelected(model, "c_rules", ["0=1"]);
    assert.strictEqual((await runner.trigger("click", "b_remove")).status, "ready");
    assert.deepStrictEqual(getDialogControl(model, "c_rules").value, []);
};
verifyRecodeRuleEditing()
    .then(() => {
    console.log("DialogQCA recode source dialog verified.");
})
    .catch((error) => {
    console.error(error);
    process.exit(1);
});
