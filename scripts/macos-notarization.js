#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const {
    archForChannelMetadata,
    projectRoot,
    productAppPathForArch,
    productAppPaths,
    productDetails,
    productDmgPaths,
    updateChannelMetadataPaths
} = require("./artifact-paths");

const details = productDetails();
const keychainProfile = String(
    process.env[`${details.envPrefix}_NOTARY_PROFILE`]
        || process.env.DIALOGFORGE_NOTARY_PROFILE
        || "developer-id-notary"
).trim();
const defaultHistoryEntries = 2;

const fail = function(message) {
    throw new Error(message);
};

const requireMacOS = function() {
    if (process.platform !== "darwin") {
        fail("macOS notarization commands must run on macOS.");
    }
};

const runCommand = function(command, args) {
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

const runXcrun = function(args) {
    runCommand("xcrun", args);
};

const resolveDialogForgeRoot = function() {
    const candidates = [
        process.env.DIALOGFORGE_ROOT || "",
        path.join(projectRoot, "DialogForge"),
        path.join(projectRoot, "../DialogForge")
    ].filter(Boolean);
    const root = candidates.find((candidate) => {
        return fs.existsSync(path.join(candidate, "package.json"))
            && fs.existsSync(path.join(candidate, "node_modules", "app-builder-bin"));
    });

    if (!root) {
        fail(
            "Could not find DialogForge with installed packaging dependencies. "
            + "Set DIALOGFORGE_ROOT or install the sibling DialogForge checkout."
        );
    }
    return root;
};

const readHistory = function() {
    const result = spawnSync("xcrun", [
        "notarytool",
        "history",
        "--keychain-profile",
        keychainProfile,
        "--output-format",
        "json"
    ], {
        cwd: projectRoot,
        encoding: "utf8"
    });

    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        process.stderr.write(String(result.stderr || ""));
        fail(`notarytool history failed with exit code ${String(result.status)}.`);
    }

    const parsed = JSON.parse(String(result.stdout || "{}"));
    return Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.history)
            ? parsed.history
            : [];
};

const historyNewestFirst = function(history) {
    return history.slice().sort((left, right) => {
        const leftTime = Date.parse(String(left.createdDate || ""));
        const rightTime = Date.parse(String(right.createdDate || ""));
        return (Number.isFinite(rightTime) ? rightTime : 0)
            - (Number.isFinite(leftTime) ? leftTime : 0);
    });
};

const submit = function() {
    productDmgPaths().forEach((dmgPath) => {
        console.log(`Submitting ${dmgPath}; waiting for the notary service.`);
        const result = spawnSync("xcrun", [
            "notarytool",
            "submit",
            dmgPath,
            "--keychain-profile",
            keychainProfile,
            "--wait",
            "--output-format",
            "json"
        ], {
            cwd: projectRoot,
            encoding: "utf8"
        });

        if (result.error) {
            throw result.error;
        }
        process.stderr.write(String(result.stderr || ""));

        const stdout = String(result.stdout || "");
        let response;
        try {
            response = JSON.parse(stdout);
        } catch {
            fail(`Could not read the notary response for ${dmgPath}:\n${stdout}`);
        }

        const status = String(response.status || "(unknown)");
        const id = String(response.id || "");
        console.log(`${path.basename(dmgPath)}: ${status}${id ? ` (id ${id})` : ""}`);
        if (status !== "Accepted") {
            fail(
                `${dmgPath} was not accepted (${status}).\n`
                + `For details, run: xcrun notarytool log ${id || "<submission-id>"} `
                + `--keychain-profile ${keychainProfile}`
            );
        }
    });
};

const showRecentHistory = function(count) {
    const history = historyNewestFirst(readHistory());
    if (history.length === 0) {
        fail("No notarization submissions were returned.");
    }

    const entries = history.slice(0, count);
    console.log(`Showing ${entries.length} of ${history.length} submission(s), newest first:`);
    entries.forEach((entry) => {
        console.log("");
        console.log(`Name: ${String(entry.name || "(unknown)")}`);
        console.log(`Status: ${String(entry.status || "(unknown)")}`);
        console.log(`Created: ${String(entry.createdDate || "(unknown)")}`);
        console.log(`ID: ${String(entry.id || "(unknown)")}`);
    });
};

const fileHash = function(filePath, algorithm, encoding) {
    return crypto.createHash(algorithm).update(fs.readFileSync(filePath)).digest(encoding);
};

const rebuildUpdaterZip = function(appPath, channelPath) {
    const dialogForgeRoot = resolveDialogForgeRoot();
    const yaml = require(path.join(dialogForgeRoot, "node_modules", "js-yaml"));
    const { appBuilderPath } = require(
        path.join(dialogForgeRoot, "node_modules", "app-builder-bin")
    );
    const outputDir = path.dirname(channelPath);
    const latest = yaml.load(fs.readFileSync(channelPath, "utf8")) || {};
    const files = Array.isArray(latest.files) ? latest.files : [];
    const zipEntry = files.find((entry) => {
        return /\.zip$/i.test(String((entry || {}).url || ""));
    });

    if (!zipEntry) {
        fail(`No updater ZIP is listed in ${channelPath}.`);
    }

    const zipPath = path.join(outputDir, String(zipEntry.url));
    const blockMapPath = `${zipPath}.blockmap`;
    const temporaryZipPath = `${zipPath}.stapled`;
    const temporaryBlockMapPath = `${blockMapPath}.stapled`;
    fs.rmSync(temporaryZipPath, { force: true });
    fs.rmSync(temporaryBlockMapPath, { force: true });

    console.log(`Rebuilding ${path.basename(zipPath)} from the stapled application.`);
    runCommand("ditto", [
        "-c",
        "-k",
        "--sequesterRsrc",
        "--keepParent",
        appPath,
        temporaryZipPath
    ]);
    runCommand(appBuilderPath, [
        "blockmap",
        "--input",
        temporaryZipPath,
        "--output",
        temporaryBlockMapPath
    ]);

    fs.renameSync(temporaryZipPath, zipPath);
    fs.renameSync(temporaryBlockMapPath, blockMapPath);

    const sha512 = fileHash(zipPath, "sha512", "base64");
    zipEntry.size = fs.statSync(zipPath).size;
    zipEntry.sha512 = sha512;
    latest.files = [zipEntry];
    latest.path = String(zipEntry.url);
    latest.sha512 = sha512;
    fs.writeFileSync(channelPath, yaml.dump(latest, { lineWidth: -1, noRefs: true }));
};

const staple = function() {
    const appPaths = productAppPaths();
    const dmgPaths = productDmgPaths();

    appPaths.forEach((appPath) => {
        console.log(`Stapling ${appPath}`);
        runXcrun(["stapler", "staple", appPath]);
        runXcrun(["stapler", "validate", appPath]);
        runCommand("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath]);
    });

    updateChannelMetadataPaths().forEach((channelPath) => {
        const arch = archForChannelMetadata(channelPath);
        if (!arch) {
            fail(`Cannot determine the architecture for ${path.basename(channelPath)}.`);
        }
        const appPath = productAppPathForArch(arch);
        if (!appPath) {
            fail(`No ${arch} application is present for ${path.basename(channelPath)}.`);
        }
        rebuildUpdaterZip(appPath, channelPath);
    });

    dmgPaths.forEach((dmgPath) => {
        console.log(`Stapling ${dmgPath}`);
        runXcrun(["stapler", "staple", dmgPath]);
        runXcrun(["stapler", "validate", dmgPath]);
    });
};

const main = function() {
    requireMacOS();
    const action = String(process.argv[2] || "").trim();

    if (action === "submit") {
        submit();
        return;
    }
    if (action === "history") {
        const requested = Number(process.argv[3]);
        const count = Number.isInteger(requested) && requested > 0
            ? requested
            : defaultHistoryEntries;
        showRecentHistory(count);
        return;
    }
    if (action === "staple") {
        staple();
        return;
    }

    fail("Unknown notarization action. Expected submit, history, or staple.");
};

if (require.main === module) {
    try {
        main();
    } catch (error) {
        console.error("[macos-notarization] Failed.");
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

module.exports = { rebuildUpdaterZip };
