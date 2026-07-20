"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");


const productRoot = path.resolve(__dirname, "..");
const candidates = [
    process.env.DIALOGFORGE_ROOT || "",
    path.join(productRoot, "DialogForge"),
    path.join(productRoot, "../DialogForge")
].filter(Boolean);
const dialogForgeRoot = candidates.find((candidate) => {
    return fs.existsSync(path.join(candidate, "scripts", "verify-production.js"));
});

if (!dialogForgeRoot) {
    throw new Error(
        "Could not find DialogForge production verification. Set DIALOGFORGE_ROOT or keep "
        + `DialogForge beside this product. Checked: ${candidates.join(", ")}`
    );
}

const result = spawnSync(process.execPath, [
    path.join(dialogForgeRoot, "scripts", "verify-production.js"),
    "--product-path",
    productRoot,
    ...process.argv.slice(2)
], {
    cwd: productRoot,
    env: process.env,
    stdio: "inherit"
});

if (result.error) {
    throw result.error;
}

process.exit(result.status || 0);
