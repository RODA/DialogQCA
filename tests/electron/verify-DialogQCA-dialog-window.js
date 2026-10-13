"use strict";

const path = require("node:path");
const process = require("node:process");
const { spawnSync } = require("node:child_process");
const { dialogForgeRoot } = require("../dialogforge");
const {
    dialogQCATruthTableBehavior
} = require(path.join(
    dialogForgeRoot,
    "tests/fixtures/product-dialog-behavior"
));


const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const productRoot = path.resolve(__dirname, "../..");
const truthTableOnly = process.argv.includes("--truth-table-only");
const verifyDialog = function(overrides) {
    const result = spawnSync(
        npmCommand,
        ["run", "verify:electron-product-dialog"],
        {
            cwd: dialogForgeRoot,
            env: {
                ...process.env,
                DIALOGFORGE_ELECTRON_PRODUCT_PATH: productRoot,
                // Verify startup visibly loads QCA before the harness enters data().
                DIALOGFORGE_ELECTRON_REQUIRED_PACKAGE: "QCA",
                DIALOGFORGE_ELECTRON_DIALOG_SETUP_COMMAND: "data(LR)",
                DIALOGFORGE_ELECTRON_WORKSPACE_OBJECT: "LR",
                DIALOGFORGE_ELECTRON_DIALOG_EXPECTED_TEXT: "Dataset:",
                DIALOGFORGE_ELECTRON_DIALOG_SELECT_DATASET: "LR",
                DIALOGFORGE_ELECTRON_DIALOG_EXPECTED_PLOT_POINTS: "18",
                DIALOGFORGE_ELECTRON_DIALOG_MIN_CONTROLS: "10",
                ...overrides
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
};

if (!truthTableOnly) {
    verifyDialog({
        DIALOGFORGE_ELECTRON_DIALOG_ID: "calibrate",
        DIALOGFORGE_ELECTRON_DIALOG_SELECT_VARIABLE: "DEV",
        DIALOGFORGE_ELECTRON_DIALOG_INPUT_VALUES: JSON.stringify({
            i_th1: "400",
            i_th2: "550",
            i_th3: "800"
        }),
        DIALOGFORGE_ELECTRON_DIALOG_MIN_DISTINCT_PLOT_Y: "4",
        DIALOGFORGE_ELECTRON_DIALOG_RESIZE_WIDTH: "895",
        DIALOGFORGE_ELECTRON_DIALOG_RESIZE_HEIGHT: "620",
        DIALOGFORGE_ELECTRON_DIALOG_GROWING_CONTROL: "plot_calibrate",
        DIALOGFORGE_ELECTRON_DIALOG_MOVING_CONTROLS: "b_reset,b_run",
        DIALOGFORGE_ELECTRON_DIALOG_STATIC_CONTROLS: "c_datasets,c_variables"
    });

    verifyDialog({
        DIALOGFORGE_ELECTRON_DIALOG_ID: "xyplot",
        DIALOGFORGE_ELECTRON_DIALOG_SETUP_COMMAND: [
            "data(LR)",
            "LR$DEV_fz <- calibrate(LR$DEV, thresholds = \"e=400, c=550, i=800\")",
            "LR$URB_fz <- calibrate(LR$URB, thresholds = \"e=250, c=500, i=800\")"
        ].join("; "),
        DIALOGFORGE_ELECTRON_DIALOG_SELECT_X: "DEV_fz",
        DIALOGFORGE_ELECTRON_DIALOG_SELECT_Y: "URB_fz",
        DIALOGFORGE_ELECTRON_DIALOG_RESIZE_WIDTH: "950",
        DIALOGFORGE_ELECTRON_DIALOG_RESIZE_HEIGHT: "750",
        DIALOGFORGE_ELECTRON_DIALOG_GROWING_CONTROL: "plot_xy",
        DIALOGFORGE_ELECTRON_DIALOG_STATIC_CONTROLS: "c_datasets,c_x,c_y",
        DIALOGFORGE_ELECTRON_DIALOG_SQUARE_PLOT: "plot_xy"
    });
}

verifyDialog({
    DIALOGFORGE_ELECTRON_DIALOG_ID:
        dialogQCATruthTableBehavior.dialogId,
    DIALOGFORGE_ELECTRON_DIALOG_SETUP_COMMAND: "data(LF)",
    DIALOGFORGE_ELECTRON_WORKSPACE_OBJECT: "LF",
    DIALOGFORGE_ELECTRON_WORKSPACE_DATASET: JSON.stringify({
        rows: 18,
        columns: ["DEV", "URB", "LIT", "IND", "STB", "SURV"]
    }),
    DIALOGFORGE_ELECTRON_DIALOG_SELECT_DATASET: "LF",
    DIALOGFORGE_ELECTRON_DIALOG_EXPECTED_PLOT_POINTS: "0",
    DIALOGFORGE_ELECTRON_DIALOG_EXPECTED_TEXT: "Outcome:",
    DIALOGFORGE_ELECTRON_DIALOG_SELECTIONS: JSON.stringify(
        dialogQCATruthTableBehavior.selections
    ),
    DIALOGFORGE_ELECTRON_DIALOG_EXPECTED_COMMAND:
        dialogQCATruthTableBehavior.command,
    DIALOGFORGE_ELECTRON_DIALOG_HISTORY_TEXT:
        dialogQCATruthTableBehavior.command,
    DIALOGFORGE_ELECTRON_DIALOG_ATTACHED_PACKAGES: "QCA",
    DIALOGFORGE_ELECTRON_DIALOG_EXPECTED_OUTPUT: "PRI",
    DIALOGFORGE_ELECTRON_DIALOG_RUN: "1"
});
