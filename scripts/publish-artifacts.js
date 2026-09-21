#!/usr/bin/env node
"use strict";

const path = require("path");
const { spawnSync } = require("child_process");

const {
    projectRoot,
    productDetails,
    productDmgPaths,
    updateChannelPaths
} = require("./artifact-paths");

const details = productDetails();
const targetRepo = String(
    process.env[`${details.envPrefix}_PUBLISH_REPO`] || `RODA/${details.id}`
).trim();
const targetTag = String(
    process.env[`${details.envPrefix}_PUBLISH_TAG`] || "latest"
).trim();
const allowUnstapled = process.argv.slice(2).includes("--allow-unstapled");

const fail = function(message) {
    throw new Error(message);
};

const requireGitHubCli = function() {
    const result = spawnSync("gh", ["--version"], { encoding: "utf8" });
    if (result.error || result.status !== 0) {
        fail("The GitHub CLI (gh) is required to publish. Install it and run `gh auth login`.");
    }
};

const assertStapled = function(dmgPaths) {
    if (allowUnstapled) {
        console.warn("Skipping the staple check because --allow-unstapled was passed.");
        return;
    }

    const unstapled = dmgPaths.filter((dmgPath) => {
        const result = spawnSync("xcrun", ["stapler", "validate", dmgPath], {
            encoding: "utf8"
        });
        return result.error || result.status !== 0;
    });

    if (unstapled.length > 0) {
        fail(
            `Not stapled:\n  ${unstapled.map((filePath) => path.basename(filePath)).join("\n  ")}\n`
            + "Run `npm run submit` and `npm run staple` first, "
            + "or pass --allow-unstapled to upload anyway."
        );
    }
};

const removePublishedMacArtifacts = function() {
    const result = spawnSync("gh", [
        "release",
        "view",
        targetTag,
        "--repo",
        targetRepo,
        "--json",
        "assets"
    ], {
        cwd: projectRoot,
        encoding: "utf8"
    });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        process.stderr.write(String(result.stderr || ""));
        fail(`Could not inspect ${targetRepo} (${targetTag}).`);
    }

    const response = JSON.parse(String(result.stdout || "{}"));
    const assets = Array.isArray(response.assets) ? response.assets : [];
    const macAsset = new RegExp(
        `^(?:${details.fileName}_(?:silicon|intel)\\.dmg|`
        + ".*-(?:arm64|x64)-mac\\.zip(?:\\.blockmap)?|"
        + "latest-(?:arm64|x64)-mac\\.yml|latest-mac\\.yml)$",
        "i"
    );

    assets.forEach((asset) => {
        const name = String((asset || {}).name || "").trim();
        if (!macAsset.test(name)) {
            return;
        }
        console.log(`Removing old macOS release asset ${name}`);
        const deletion = spawnSync("gh", [
            "release",
            "delete-asset",
            targetTag,
            name,
            "--repo",
            targetRepo,
            "--yes"
        ], {
            cwd: projectRoot,
            stdio: "inherit"
        });
        if (deletion.error) {
            throw deletion.error;
        }
        if (deletion.status !== 0) {
            fail(`Could not delete old release asset ${name}.`);
        }
    });
};

const upload = function(paths) {
    console.log(`Uploading to ${targetRepo} (${targetTag}):`);
    paths.forEach((filePath) => {
        console.log(`  ${path.basename(filePath)}`);
    });

    const result = spawnSync("gh", [
        "release",
        "upload",
        targetTag,
        "--repo",
        targetRepo,
        "--clobber",
        ...paths
    ], {
        cwd: projectRoot,
        stdio: "inherit"
    });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        fail(`gh release upload failed with exit code ${String(result.status)}.`);
    }
};

const main = function() {
    requireGitHubCli();
    const dmgPaths = productDmgPaths();
    if (dmgPaths.length !== 2) {
        fail("Both the Apple Silicon and Intel DMGs must be present before publishing.");
    }

    if (process.platform === "darwin") {
        assertStapled(dmgPaths);
    } else {
        console.warn("Not running on macOS, so the staple check was skipped.");
    }

    const updatePaths = updateChannelPaths();
    const metadataPaths = updatePaths.filter((entry) => entry.endsWith("-mac.yml"));
    if (metadataPaths.length !== 2) {
        fail("Both latest-arm64-mac.yml and latest-x64-mac.yml must be present before publishing.");
    }

    removePublishedMacArtifacts();
    upload([...dmgPaths, ...updatePaths]);
};

try {
    main();
} catch (error) {
    console.error("[publish-artifacts] Failed.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
}
