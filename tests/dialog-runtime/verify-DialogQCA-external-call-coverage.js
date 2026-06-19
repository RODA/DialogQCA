"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { readDialogSourceSummary } = require(require("../dialogforge").dialogForgeModule("shared/dialog-runtime/dialogSource"));
const { createDialogRuntimePlan } = require(require("../dialogforge").dialogForgeModule("shared/dialog-runtime/custom-js/dialogRuntimePlan"));
const { createCompositeDialogExternalCallHost } = require(require("../dialogforge").dialogForgeModule("shared/dialog-runtime/custom-js/compositeExternalCallHost"));
const { createDialogExternalCallHost } = require(require("../dialogforge").dialogForgeModule("shared/dialog-runtime/custom-js/externalCallHost"));
const { createQcaExternalCallHost } = require("../../qca/qcaExternalCallHost");
const rootDir = path.resolve(__dirname, "../..");
const host = createCompositeDialogExternalCallHost({
    shared: createDialogExternalCallHost(),
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
            getXYPlotPreview: async function () {
                return {};
            }
        })
    }
});
const registry = JSON.parse(fs.readFileSync(path.join(rootDir, "dialogs/dialogs.json"), "utf8"));
registry.forEach((dialog) => {
    const source = readDialogSourceSummary(rootDir, dialog);
    const plan = createDialogRuntimePlan(source, host);
    assert.deepStrictEqual(plan.externalCalls.unsupported, [], `DialogQCA/${dialog.id} has unsupported external calls.`);
});
console.log("DialogQCA external-call coverage verified.");
