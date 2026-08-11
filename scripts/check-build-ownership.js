"use strict";

const fs = require("fs");
const path = require("path");

const productRoot = path.resolve(__dirname, "..");

const fail = function(message) {
    throw new Error(message);
};

const licenseReference = "SEE LICENSE IN LICENSE";
const licenseText = "Academic Non-Commercial License (see LICENSE file for details).";
const macCopyright = "© 2025-2026 Adrian Dusa — " + licenseText;

const readJson = function(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
};

const readBuildArchitectures = function(packageJson, platform) {
    const build = packageJson.build || {};
    const config = build[platform] || {};
    const targets = Array.isArray(config.target)
        ? config.target
        : [config.target].filter(Boolean);

    return targets.flatMap((target) => {
        const arch = target && typeof target === "object"
            ? target.arch
            : [];
        if (Array.isArray(arch)) {
            return arch;
        }
        return arch ? [arch] : [];
    }).map((arch) => {
        return String(arch || "").trim();
    }).filter(Boolean);
};

const expectedArchitectureForPlatform = function(platform) {
    return platform === "mac" ? "arm64" : "x64";
};

const assertPlatformArchitecture = function(packageJson, platform) {
    const expected = expectedArchitectureForPlatform(platform);
    const architectures = readBuildArchitectures(packageJson, platform);
    if (architectures.length === 0
        || architectures.some((architecture) => architecture !== expected)) {
        fail("package.json must declare build." + platform + ".target architecture as " + expected + ".");
    }
};

const assertLicenseMetadata = function(packageJson) {
    const build = packageJson.build || {};
    const extraResources = Array.isArray(build.extraResources)
        ? build.extraResources
        : [];
    const mac = build.mac || {};
    const win = build.win || {};
    const extendInfo = mac.extendInfo || {};

    if (packageJson.author !== "Adrian Dusa") {
        fail("package.json must declare Adrian Dusa as author.");
    }
    if (!Array.isArray(packageJson.contributors)
        || packageJson.contributors.length !== 1
        || packageJson.contributors[0] !== "RODA") {
        fail("package.json must declare RODA as contributor.");
    }
    if (packageJson.license !== licenseReference) {
        fail("package.json must reference the root LICENSE file.");
    }
    if (!extraResources.includes("LICENSE")) {
        fail("package.json build.extraResources must include LICENSE.");
    }
    if (win.legalTrademarks !== licenseText) {
        fail("package.json build.win.legalTrademarks must describe the license.");
    }
    if (extendInfo.NSHumanReadableCopyright !== macCopyright) {
        fail("package.json build.mac.extendInfo.NSHumanReadableCopyright must describe the license.");
    }
};

const assertAutoUpdatePolicy = function(packageJson) {
    const autoUpdate = (packageJson.product || {}).autoUpdate || {};
    const releaseTags = (packageJson.product || {}).releaseTags || {};

    if (Object.prototype.hasOwnProperty.call(autoUpdate, "releaseTag")) {
        fail("package.json product.autoUpdate must not pin a platform-specific releaseTag.");
    }
    if (releaseTags.linuxIntel !== "li"
        || releaseTags.windowsIntel !== "wi"
        || releaseTags.macosIntel !== "mi"
        || releaseTags.macosSilicon !== "ms"
        || releaseTags.webrVFS !== "web") {
        fail("package.json product.releaseTags must define the DialogQCA release tags.");
    }
};

const assertBuildScriptReleaseTags = function(scripts) {
    const buildProduct = fs.readFileSync(path.join(productRoot, "scripts/build-product.js"), "utf8");

    [
        "linuxIntel",
        "windowsIntel",
        "macosIntel",
        "macosSilicon",
        "webrVFS",
        "readRequiredReleaseTags(packagePath)",
        "GITHUB_REPOSITORY",
        "remote.origin.url",
        "resolveReleaseRepository(packagePath)",
        "DIALOGFORGE_RELEASE_REPOSITORY",
        "DIALOGFORGE_RELEASE_TAG",
        '...(forceMacosIntel ? ["--arch", "x64"] : [])',
        "cleanupBuildOutput(dialogForgeRoot, outputDir, platform, forceMacosIntel)",
        "scripts/build-desktop.js",
        "path.join(productRoot, \"dist\")",
        "builder-effective-config.yaml",
        "rewriteMacUpdateFeed(dialogForgeRoot, outputDir)",
        "fileName === stableDmgName",
        "if (entry.isDirectory())"
    ].forEach((expected) => {
        if (!buildProduct.includes(expected)) {
            fail("scripts/build-product.js must pass platform-specific packaging metadata: " + expected);
        }
    });

    [
        "injectAutoUpdatePolicy",
        "forceMacosIntelBuildTarget",
        "fs.writeFileSync(packagePath"
    ].forEach((forbidden) => {
        if (buildProduct.includes(forbidden)) {
            fail("scripts/build-product.js must not rewrite the source package.json: " + forbidden);
        }
    });

    if (buildProduct.includes("runNpm(dialogForgeRoot")) {
        fail("Product builds must not populate DialogForge/dist.");
    }

    if (buildProduct.includes("entry.isDirectory()")
        && buildProduct.includes("entry.name.startsWith(\"mac-\")")) {
        fail("scripts/build-product.js must keep unpacked macOS app directories for local production testing.");
    }
};

const assertRequiredScripts = function() {
    const packageJson = readJson(path.join(productRoot, "package.json"));
    const scripts = packageJson.scripts || {};
    const macBuild = packageJson.build && packageJson.build.mac;

    if (!macBuild
        || macBuild.artifactName !== "${productName}-${version}-${arch}-mac.${ext}") {
        fail("macOS update artifacts must include the architecture in their filename.");
    }
    const required = [
        "start",
        "check",
        "build"
    ];
    const missing = required.filter((scriptName) => {
        return !scripts[scriptName];
    });

    if (missing.length > 0) {
        fail("Missing product-owned development/build scripts: " + missing.join(", "));
    }

    const startScript = fs.readFileSync(path.join(productRoot, "scripts/start-product.js"), "utf8");
    [
        "--forge-path",
        "DIALOGFORGE_ROOT",
        "\"dev:watch\"",
        "\"--devtools\"",
        "productRoot"
    ].forEach((expected) => {
        if (!startScript.includes(expected)) {
            fail("scripts/start-product.js must preserve the product-owned development contract: " + expected);
        }
    });

    if (Object.values(scripts).some((script) => String(script || "").includes("--sign"))) {
        fail("Product build scripts must keep signing opt-in as an explicit caller argument.");
    }

    assertPlatformArchitecture(packageJson, "mac");
    assertPlatformArchitecture(packageJson, "win");
    assertPlatformArchitecture(packageJson, "linux");
    assertLicenseMetadata(packageJson);
    assertAutoUpdatePolicy(packageJson);
    assertBuildScriptReleaseTags(scripts);

    const webrLibraryScript = fs.readFileSync(path.join(productRoot, "scripts/download-webr-library.js"), "utf8");
    [
        'product.releaseTags.webrVFS',
        'WebR package library lookup expects release tag "${configuredTag}"'
    ].forEach((expected) => {
        if (!webrLibraryScript.includes(expected)) {
            fail("scripts/download-webr-library.js must read the configured WebR release tag: " + expected);
        }
    });

    const platformAliases = [
        "build:linux",
        "build:windows",
        "build:macos"
    ].filter((scriptName) => {
        return Boolean(scripts[scriptName]);
    });

    if (platformAliases.length > 0) {
        fail("Product build scripts should rely on host OS detection, not platform aliases: " + platformAliases.join(", "));
    }
};

const assertWorkflows = function() {
    const buildWorkflow = path.join(productRoot, ".github/workflows/build.yml");
    const macosWorkflow = path.join(productRoot, ".github/workflows/build-macos.yml");
    const releaseWorkflow = path.join(productRoot, ".github/workflows/release-windows.yml");

    if (!fs.existsSync(buildWorkflow)) {
        fail("Missing product-owned build workflow.");
    }
    if (!fs.existsSync(macosWorkflow)) {
        fail("Missing product-owned macOS build workflow.");
    }
    if (!fs.existsSync(releaseWorkflow)) {
        fail("Missing maintainer Windows release request workflow.");
    }

    const buildText = fs.readFileSync(buildWorkflow, "utf8");
    const macosText = fs.readFileSync(macosWorkflow, "utf8");
    const linuxText = fs.readFileSync(path.join(productRoot, ".github/workflows/build-linux.yml"), "utf8");
    const windowsText = fs.readFileSync(path.join(productRoot, ".github/workflows/build-windows.yml"), "utf8");
    [buildText, macosText].forEach((workflowText) => {
        if (!workflowText.includes("runs-on: macos-15-intel")
            || !workflowText.includes("npm run build -- --macos-intel")) {
            fail("GitHub macOS workflows must build Intel artifacts explicitly.");
        }
    });

    const releaseText = fs.readFileSync(releaseWorkflow, "utf8");
    if (!releaseText.includes("DIALOGFORGE_SIGNING_TOKEN")) {
        fail("Windows release request must require DIALOGFORGE_SIGNING_TOKEN.");
    }
    if (!releaseText.includes("sign-windows-product.yml")) {
        fail("Windows release request must call the DialogForge signing broker.");
    }
    if (!linuxText.includes("default: li")
        || !windowsText.includes("default: wi")
        || !macosText.includes("default: mi")
        || !releaseText.includes("default: wi")
        || !buildText.includes("default: li")
        || !buildText.includes("default: wi")
        || !buildText.includes("default: mi")) {
        fail("GitHub release workflows must default to platform-specific DialogQCA release tags.");
    }

    if (![buildText, linuxText].every((workflowText) => {
        return workflowText.includes("latest-linux.yml")
            && workflowText.includes("*.AppImage.blockmap");
    })) {
        fail("Linux release workflows must upload electron-updater metadata.");
    }
    if (![buildText, windowsText].every((workflowText) => {
        return workflowText.includes("latest.yml")
            && workflowText.includes("*.exe.blockmap");
    })) {
        fail("Windows build workflows must preserve electron-updater metadata.");
    }
    if (![buildText, macosText].every((workflowText) => {
        return workflowText.includes("latest-mac.yml")
            && workflowText.includes("*.zip")
            && workflowText.includes("*.zip.blockmap")
            && !workflowText.includes("*.dmg.blockmap")
            && workflowText.includes("must all exist before release cleanup")
            && workflowText.includes("gh release delete-asset")
            && workflowText.includes("assets=(\"${dmgs[@]}\" \"${zips[@]}\" \"${blockmaps[@]}\" \"${latest_files[@]}\")");
    })) {
        fail("macOS release workflows must validate outputs, clear stale assets, and upload updater metadata.");
    }
};

const main = function() {
    assertRequiredScripts();
    assertWorkflows();
    console.log("Product build ownership contract passed.");
};

main();
