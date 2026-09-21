#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const { projectRoot, productDetails } = require("./artifact-paths");

const details = productDetails();
const sourceRepo = String(
    process.env[`${details.envPrefix}_PUBLISH_REPO`] || `RODA/${details.id}`
).trim();
const sourceTag = String(
    process.env[`${details.envPrefix}_PUBLISH_TAG`] || "latest"
).trim();
const outputDir = path.join(projectRoot, "build", "output");
const appDir = path.join(outputDir, "mac");

const fail = function(message) {
    throw new Error(message);
};

const run = function(command, args) {
    const result = spawnSync(command, args, {
        cwd: projectRoot,
        stdio: "inherit"
    });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        fail(`${command} failed with exit code ${String(result.status)}.`);
    }
};

const requireGitHubCli = function() {
    const result = spawnSync("gh", ["--version"], { encoding: "utf8" });
    if (result.error || result.status !== 0) {
        fail("The GitHub CLI (gh) is required. Install it and run `gh auth login`.");
    }
};

const download = function() {
    const patterns = [
        `${details.fileName}_intel.dmg`,
        "*-x64-mac.zip",
        "latest-x64-mac.yml"
    ];
    fs.mkdirSync(outputDir, { recursive: true });

    const args = [
        "release",
        "download",
        sourceTag,
        "--repo",
        sourceRepo,
        "--dir",
        outputDir,
        "--clobber"
    ];
    patterns.forEach((pattern) => {
        args.push("--pattern", pattern);
    });

    console.log(`Downloading the Intel build from ${sourceRepo} (${sourceTag}):`);
    patterns.forEach((pattern) => {
        console.log(`  ${pattern}`);
    });
    run("gh", args);
};

const expandApplication = function() {
    const zipPaths = fs.readdirSync(outputDir)
        .filter((name) => /-x64-mac\.zip$/i.test(name))
        .map((name) => path.join(outputDir, name));

    if (zipPaths.length !== 1) {
        fail(
            `Expected exactly one Intel updater ZIP after download; found ${String(zipPaths.length)}. `
            + "Remove stale *-x64-mac.zip files from build/output or the release."
        );
    }

    fs.rmSync(appDir, { recursive: true, force: true });
    fs.mkdirSync(appDir, { recursive: true });

    const zipPath = zipPaths[0];
    console.log(`Expanding ${path.basename(zipPath)} into ${path.relative(projectRoot, appDir)}`);
    run("ditto", ["-x", "-k", zipPath, appDir]);

    const appPath = path.join(appDir, `${details.name}.app`);
    if (!fs.existsSync(appPath)) {
        fail(`Expanding ${path.basename(zipPath)} did not produce ${appPath}.`);
    }

    console.log(`Ready: ${path.relative(projectRoot, appPath)}`);
};

const main = function() {
    if (process.platform !== "darwin") {
        fail("The Intel macOS build can only be prepared for notarization on macOS.");
    }

    requireGitHubCli();
    download();
    expandApplication();
    console.log("");
    console.log("Both architectures are now present. Next: npm run submit, then npm run staple.");
};

try {
    main();
} catch (error) {
    console.error("[fetch-intel-artifacts] Failed.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
}
