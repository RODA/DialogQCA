"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { createDialogControlModelFromSources } = require(require("../dialogforge").dialogForgeModule("shared/dialog-runtime/custom-js/dialogControlModel"));
const { createDialogScriptRunner, listDialogScriptControlReferences } = require(require("../dialogforge").dialogForgeModule("shared/dialog-runtime/custom-js/dialogScriptRunner"));
const rootDir = path.resolve(__dirname, "../..");
const sourceRoots = [
    "dialogs/source"
];
const collectDialogFiles = function (directory) {
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            files.push(...collectDialogFiles(fullPath));
        }
        else if (entry.isFile() && entry.name === "dialog.json") {
            files.push(fullPath);
        }
    }

    return files;
};
const readDialogControls = function (source) {
    return (source.elements || []).map((element, index) => {
        return {
            name: element.nameid || element.name || element.id || "control_" + index,
            value: element.value || ""
        };
    });
};
const createHarness = function () {
    return {
        callExternal: async function (name) {
            if (name === "getDatasetVariablesForDialog") {
                return ["A", "B"];
            }
            if (name === "qca.listTruthTables") {
                return [
                    {
                        name: "tt1",
                        options: {
                            conditions: ["A", "B"]
                        },
                        ids: ["1", "0"],
                        out: ["1", "0"],
                        cases: ["case1", "case2"]
                    }
                ];
            }
            if (name === "qca.validateCalibrateDialog") {
                return "calibrate(x)";
            }
            return null;
        }
    };
};
const createDocumentStub = function () {
    const createElement = function () {
        return {
            style: {},
            dataset: {},
            isConnected: false,
            innerHTML: "",
            textContent: "",
            appendChild(child) {
                child.isConnected = true;
            }
        };
    };
    return {
        body: createElement(),
        createElement
    };
};
const verify = async function () {
    const failures = [];
    for (const sourceRoot of sourceRoots) {
        const directory = path.join(rootDir, sourceRoot);
        const files = collectDialogFiles(directory);
        for (const fullPath of files) {
            const source = JSON.parse(fs.readFileSync(fullPath, "utf8"));
            const customJS = source.customJS || "";
            const model = createDialogControlModelFromSources(readDialogControls(source));
            const runner = createDialogScriptRunner({
                model,
                document: createDocumentStub(),
                controlNames: listDialogScriptControlReferences(customJS),
                harness: createHarness(),
                listObjects: function (kind) {
                    return kind === "datasets" ? ["sample_data"] : [];
                },
                listColumns: function () {
                    return ["A", "B"];
                },
                enableSearch: function () {
                    return undefined;
                },
                resetDialog: function () {
                    return undefined;
                }
            });
            const result = await runner.run(customJS);
            if (result.status !== "ready") {
                failures.push({
                    file: path.relative(rootDir, fullPath),
                    error: result.error
                });
            }
        }
    }
    assert.deepStrictEqual(failures, []);
};
verify()
    .then(() => {
    console.log("DialogQCA customJS compatibility verified.");
})
    .catch((error) => {
    console.error(error);
    process.exit(1);
});
