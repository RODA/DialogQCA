"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const scriptDir = __dirname;
const productRoot = path.resolve(scriptDir, "..");
const dialogForgeRootCandidates = [
    path.join(productRoot, "DialogForge"),
    path.join(productRoot, "../DialogForge")
];
const dialogForgeRoot = dialogForgeRootCandidates.find((candidate) => {
    return fs.existsSync(path.join(candidate, "scripts/generate-core-sdk.js"));
});
const candidates = [
    path.join(productRoot, "node_modules/typescript/bin/tsc"),
    dialogForgeRoot
        ? path.join(dialogForgeRoot, "node_modules/typescript/bin/tsc")
        : "",
    path.join(productRoot, "../node_modules/typescript/bin/tsc")
].filter(Boolean);
const tscPath = candidates.find((candidate) => {
    return fs.existsSync(candidate);
});

if (!tscPath) {
    throw new Error(
        "Could not find the TypeScript compiler. Install DialogForge dependencies first, " +
        "or set up local product dependencies. Checked: " + candidates.join(", ")
    );
}

const copyDirectory = function(source, target) {
    fs.rmSync(target, {
        recursive: true,
        force: true
    });
    fs.mkdirSync(path.dirname(target), {
        recursive: true
    });
    fs.cpSync(source, target, {
        recursive: true
    });
};

const prepareDialogForgeCoreSdk = function() {
    const installedSdk = path.join(productRoot, "node_modules/@dialogforge/core");

    if (fs.existsSync(path.join(installedSdk, "package.json"))) {
        return;
    }

    if (!dialogForgeRoot) {
        return;
    }

    const generateSdkScript = path.join(dialogForgeRoot, "scripts/generate-core-sdk.js");
    const result = spawnSync(process.execPath, [generateSdkScript], {
        cwd: dialogForgeRoot,
        env: process.env,
        stdio: "inherit"
    });

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        process.exit(result.status || 1);
    }

    const generatedSdk = path.join(dialogForgeRoot, "dist/sdk/core");

    if (!fs.existsSync(path.join(generatedSdk, "package.json"))) {
        throw new Error(
            "DialogForge core SDK was not generated at " + generatedSdk
        );
    }

    copyDirectory(generatedSdk, installedSdk);
};

const prepareNodeTypes = function() {
    const installedTypes = path.join(productRoot, "node_modules/@types/node");

    if (fs.existsSync(path.join(installedTypes, "package.json"))) {
        return;
    }

    if (!dialogForgeRoot) {
        return;
    }

    const dialogForgeTypes = path.join(dialogForgeRoot, "node_modules/@types/node");

    if (!fs.existsSync(path.join(dialogForgeTypes, "package.json"))) {
        return;
    }

    copyDirectory(dialogForgeTypes, installedTypes);
};

prepareDialogForgeCoreSdk();
prepareNodeTypes();

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
