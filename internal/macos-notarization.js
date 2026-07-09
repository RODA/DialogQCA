#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const keychainProfile = String(
    process.env.DIALOGQCA_NOTARY_PROFILE || process.env.DIALOGFORGE_NOTARY_PROFILE || "developer-id-notary"
).trim();

const fail = function(message) {
    throw new Error(message);
};

const readObject = function(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
};

const requireMacOS = function() {
    if (process.platform !== "darwin") {
        fail("macOS notarization commands must run on macOS.");
    }
};

const productDmgPath = function() {
    const packagePath = path.join(projectRoot, "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    const product = readObject(packageJson.product);
    const productName = String(
        product.name || product.displayName || packageJson.productName || packageJson.name || "DialogQCA"
    ).trim();
    const fileName = productName.replace(/\s+/g, "_")
        + "_silicon.dmg";
    const dmgPath = path.join(projectRoot, "build", "output", fileName);

    if (!fs.existsSync(dmgPath)) {
        fail(`Missing built DMG: ${dmgPath}`);
    }

    return dmgPath;
};

const productAppPath = function() {
    const packagePath = path.join(projectRoot, "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    const product = readObject(packageJson.product);
    const productName = String(
        product.name || product.displayName || packageJson.productName || packageJson.name || "DialogQCA"
    ).trim();
    const appPath = path.join(projectRoot, "build", "output", "mac-arm64", `${productName}.app`);

    if (!fs.existsSync(appPath)) {
        fail(`Missing built app bundle: ${appPath}`);
    }

    return appPath;
};

const runInherited = function(args) {
    const result = spawnSync("xcrun", args, {
        cwd: projectRoot,
        stdio: "inherit"
    });

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        fail(`xcrun failed with exit code ${String(result.status)}.`);
    }
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

const latestHistoryEntries = function(history) {
    return history.slice().sort((left, right) => {
        const leftTime = Date.parse(String(left.createdDate || ""));
        const rightTime = Date.parse(String(right.createdDate || ""));
        const normalizedLeft = Number.isFinite(leftTime) ? leftTime : 0;
        const normalizedRight = Number.isFinite(rightTime) ? rightTime : 0;

        return normalizedRight - normalizedLeft;
    }).slice(0, 2);
};

const assertAppIsReadyForNotarization = function() {
    const appPath = productAppPath();
    const result = spawnSync("codesign", ["-dv", "--verbose=4", appPath], {
        cwd: projectRoot,
        encoding: "utf8"
    });

    if (result.error) {
        throw result.error;
    }

    const output = `${String(result.stdout || "")}${String(result.stderr || "")}`;

    if (result.status !== 0) {
        process.stderr.write(output);
        fail(`codesign inspection failed for ${appPath}.`);
    }

    const hasDeveloperId = output.includes("Authority=Developer ID Application:");
    const hasTimestamp = output.includes("Timestamp=");
    const hasHardenedRuntime = output.includes("flags=0x10000(runtime)")
        || output.includes("Runtime Version=");

    if (!hasDeveloperId || !hasTimestamp || !hasHardenedRuntime) {
        const reasons = [];

        if (!hasDeveloperId) {
            reasons.push("missing Developer ID signature");
        }
        if (!hasTimestamp) {
            reasons.push("missing secure timestamp");
        }
        if (!hasHardenedRuntime) {
            reasons.push("missing hardened runtime");
        }

        fail(
            `App bundle is not ready for notarization (${reasons.join(", ")}). ` +
            "Build with npm run build -- --sign and submit that artifact before running any ad-hoc build."
        );
    }
};

const submit = function() {
    assertAppIsReadyForNotarization();
    const dmgPath = productDmgPath();

    console.log(`Submitting ${dmgPath}`);
    runInherited([
        "notarytool",
        "submit",
        dmgPath,
        "--keychain-profile",
        keychainProfile
    ]);
};

const showLatestHistory = function() {
    const latest = latestHistoryEntries(readHistory());

    if (latest.length === 0) {
        throw new Error("No notarization submissions were returned.");
    }

    latest.forEach((entry, index) => {
        if (index > 0) {
            console.log("");
        }
        console.log(`Submission ${String(index + 1)}:`);
        console.log(`Name: ${String(entry.name || "(unknown)")}`);
        console.log(`Status: ${String(entry.status || "(unknown)")}`);
        console.log(`Created: ${String(entry.createdDate || "(unknown)")}`);
        console.log(`ID: ${String(entry.id || "(unknown)")}`);
    });
};

const staple = function() {
    const dmgPath = productDmgPath();

    console.log(`Stapling ${dmgPath}`);
    runInherited([
        "stapler",
        "staple",
        dmgPath
    ]);
};

const main = function() {
    requireMacOS();
    const action = String(process.argv[2] || "").trim();

    if (action === "submit") {
        submit();
        return;
    }

    if (action === "history") {
        showLatestHistory();
        return;
    }

    if (action === "staple") {
        staple();
        return;
    }

    fail("Unknown notarization action. Expected submit, history, or staple.");
};

main();
