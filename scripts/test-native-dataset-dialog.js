"use strict";

const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { dialogForgeRoot } = require("../tests/dialogforge");


const productRoot = path.resolve(__dirname, "..");
const run = function(script, args, cwd) {
    const result = spawnSync(process.execPath, [script, ...args], {
        cwd,
        env: process.env,
        stdio: "inherit"
    });

    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        process.exit(result.status || 1);
    }
};


// Always compile and stage current sources; an old dist must not certify a fix.
run(path.join(dialogForgeRoot, "scripts/build-desktop.js"), [], dialogForgeRoot);
run(path.join(productRoot, "tests/electron/verify-DialogQCA-dialog-window.js"), [], productRoot);
run(path.join(productRoot, "tests/verify-venn-dialog.js"), [], productRoot);
run(path.join(productRoot, "tests/verify-desktop-dialog-availability.js"), [], productRoot);
