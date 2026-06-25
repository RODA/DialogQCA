"use strict";

const path = require("node:path");
const process = require("node:process");
const { spawnSync } = require("node:child_process");
const { dialogForgeRoot } = require("../dialogforge");


const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const productRoot = path.resolve(__dirname, "../..");
const result = spawnSync(
    npmCommand,
    ["run", "verify:electron-product-dialog"],
    {
        cwd: dialogForgeRoot,
        env: {
            ...process.env,
            DIALOGFORGE_ELECTRON_PRODUCT_PATH: productRoot,
            DIALOGFORGE_ELECTRON_DIALOG_ID: "calibrate",
            DIALOGFORGE_ELECTRON_REQUIRED_PACKAGE: "QCA",
            DIALOGFORGE_ELECTRON_DIALOG_SETUP_COMMAND: "data(LR)",
            DIALOGFORGE_ELECTRON_WORKSPACE_OBJECT: "LR",
            DIALOGFORGE_ELECTRON_DIALOG_EXPECTED_TEXT: "Dataset:",
            DIALOGFORGE_ELECTRON_DIALOG_SELECT_DATASET: "LR",
            DIALOGFORGE_ELECTRON_DIALOG_SELECT_VARIABLE: "DEV",
            DIALOGFORGE_ELECTRON_DIALOG_EXPECTED_PLOT_POINTS: "18",
            DIALOGFORGE_ELECTRON_DIALOG_MIN_CONTROLS: "10"
        },
        stdio: "inherit"
    }
);

if (result.error) {
    throw result.error;
}

if (result.status !== 0) {
    process.exit(result.status ?? 1);
}
