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

const submit = function() {
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
