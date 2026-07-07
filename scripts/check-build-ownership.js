"use strict";

const fs = require("fs");
const path = require("path");

const productRoot = path.resolve(__dirname, "..");

const fail = function(message) {
    throw new Error(message);
};

const readJson = function(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
};

const assertRequiredScripts = function() {
    const packageJson = readJson(path.join(productRoot, "package.json"));
    const scripts = packageJson.scripts || {};
    const required = [
        "check",
        "build",
        "build:linux",
        "build:windows",
        "build:macos"
    ];
    const missing = required.filter((scriptName) => {
        return !scripts[scriptName];
    });

    if (missing.length > 0) {
        fail("Missing product-owned build scripts: " + missing.join(", "));
    }

    if (scripts["build:macos:nosign"]) {
        fail("Do not expose maintainer release details in public product scripts. Use build:macos.");
    }

    if (String(scripts["build:macos"] || "").includes("--nosign")) {
        fail("Do not expose maintainer release details in public product scripts.");
    }
};

const assertWorkflows = function() {
    const buildWorkflow = path.join(productRoot, ".github/workflows/build.yml");
    const releaseWorkflow = path.join(productRoot, ".github/workflows/release-windows.yml");

    if (!fs.existsSync(buildWorkflow)) {
        fail("Missing product-owned build workflow.");
    }
    if (!fs.existsSync(releaseWorkflow)) {
        fail("Missing maintainer Windows release request workflow.");
    }

    const releaseText = fs.readFileSync(releaseWorkflow, "utf8");
    if (!releaseText.includes("DIALOGFORGE_SIGNING_TOKEN")) {
        fail("Windows release request must require DIALOGFORGE_SIGNING_TOKEN.");
    }
    if (!releaseText.includes("sign-windows-product.yml")) {
        fail("Windows release request must call the DialogForge signing broker.");
    }
};

const main = function() {
    assertRequiredScripts();
    assertWorkflows();
    console.log("Product build ownership contract passed.");
};

main();
