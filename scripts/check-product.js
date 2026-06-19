"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const scriptDir = __dirname;
const productRoot = path.resolve(scriptDir, "..");
const candidates = [
    path.join(productRoot, "node_modules/typescript/bin/tsc"),
    path.join(productRoot, "DialogForge/node_modules/typescript/bin/tsc"),
    path.join(productRoot, "../DialogForge/node_modules/typescript/bin/tsc"),
    path.join(productRoot, "../node_modules/typescript/bin/tsc")
];
const tscPath = candidates.find((candidate) => {
    return fs.existsSync(candidate);
});

if (!tscPath) {
    throw new Error(
        "Could not find the TypeScript compiler. Install DialogForge dependencies first, " +
        "or set up local product dependencies. Checked: " + candidates.join(", ")
    );
}

const result = spawnSync(process.execPath, [tscPath, "-p", path.join(productRoot, "tsconfig.json"), "--noEmit"], {
    cwd: productRoot,
    env: process.env,
    stdio: "inherit"
});

if (result.error) {
    throw result.error;
}

if (result.status !== 0) {
    process.exit(result.status || 1);
}
