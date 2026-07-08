"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const productRoot = path.resolve(__dirname, "..");
const macosIntelArgument = "--macos-intel";
const updateReleaseRepository = "dusadrian/binaries";
const updateReleaseTags = {
    linux: "dqli",
    windows: "dqwi",
    macosIntel: "dqmi",
    macosSilicon: "dqms"
};

const npmInvocation = function(args) {
    const npmExecPath = String(process.env.npm_execpath || "").trim();

    if (npmExecPath) {
        return {
            command: process.execPath,
            args: [npmExecPath, ...args]
        };
    }

    return {
        command: process.platform === "win32" ? "npm.cmd" : "npm",
        args
    };
};

const resolveDialogForgeRoot = function() {
    const candidates = [
        process.env.DIALOGFORGE_ROOT || "",
        path.join(productRoot, "DialogForge"),
        path.join(productRoot, "../DialogForge")
    ].filter(Boolean);

    const root = candidates.find((candidate) => {
        return fs.existsSync(path.join(candidate, "package.json"))
            && fs.existsSync(path.join(candidate, "scripts/package-product.js"));
    });

    if (!root) {
        throw new Error(
            "Could not find DialogForge. Set DIALOGFORGE_ROOT or keep DialogForge " +
            "as a sibling checkout next to this product. Checked: " + candidates.join(", ")
        );
    }

    return root;
};

const runNpm = function(cwd, args) {
    const invocation = npmInvocation(args);
    const result = spawnSync(invocation.command, invocation.args, {
        cwd,
        env: process.env,
        stdio: "inherit",
        shell: process.platform === "win32" && invocation.command.endsWith(".cmd")
    });

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        process.exit(result.status || 1);
    }
};

const runNode = function(cwd, args) {
    const result = spawnSync(process.execPath, args, {
        cwd,
        env: process.env,
        stdio: "inherit"
    });

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        process.exit(result.status || 1);
    }
};

const readJson = function(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
};

const writeJson = function(filePath, value) {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 4) + "\n");
};

const removeIfExists = function(filePath) {
    fs.rmSync(filePath, {
        recursive: true,
        force: true
    });
};

const requestedPlatform = function(args) {
    const platformIndex = args.indexOf("--platform");
    if (platformIndex >= 0) {
        return String(args[platformIndex + 1] || "").trim();
    }

    const inlinePlatform = args.find((arg) => {
        return String(arg || "").startsWith("--platform=");
    });
    if (inlinePlatform) {
        return inlinePlatform.slice("--platform=".length).trim();
    }

    if (process.platform === "darwin") {
        return "macos";
    }
    if (process.platform === "win32") {
        return "windows";
    }
    return "linux";
};

const updateReleaseTagForBuild = function(args, forceMacosIntel) {
    const platform = requestedPlatform(args);

    if (platform === "linux") {
        return updateReleaseTags.linux;
    }
    if (platform === "windows") {
        return updateReleaseTags.windows;
    }
    if (platform === "macos") {
        return forceMacosIntel
            ? updateReleaseTags.macosIntel
            : updateReleaseTags.macosSilicon;
    }

    return updateReleaseTags.macosSilicon;
};

const injectAutoUpdatePolicy = function(packagePath, releaseTag) {
    const packageJson = readJson(packagePath);
    packageJson.product = packageJson.product && typeof packageJson.product === "object"
        ? packageJson.product
        : {};
    packageJson.product.autoUpdate = {
        releaseRepository: updateReleaseRepository,
        releaseTag
    };

    writeJson(packagePath, packageJson);
};

const rewriteMacUpdateFeed = function(dialogForgeRoot, outputDir) {
    const latestPath = path.join(outputDir, "latest-mac.yml");
    if (!fs.existsSync(latestPath)) {
        return;
    }

    const yaml = require(path.join(dialogForgeRoot, "node_modules/js-yaml"));
    const latest = yaml.load(fs.readFileSync(latestPath, "utf8")) || {};
    const files = Array.isArray(latest.files) ? latest.files : [];
    const zipEntry = files.find((entry) => {
        return /\.zip$/i.test(String((entry || {}).url || ""));
    });

    if (!zipEntry) {
        return;
    }

    const zipName = String(zipEntry.url || "");
    const zipPath = path.join(outputDir, zipName);
    if (fs.existsSync(zipPath)) {
        zipEntry.size = fs.statSync(zipPath).size;
    }

    latest.files = [zipEntry];
    latest.path = zipName;
    latest.sha512 = zipEntry.sha512;
    fs.writeFileSync(latestPath, yaml.dump(latest, {
        lineWidth: -1,
        noRefs: true
    }));
};

const cleanupBuildOutput = function(dialogForgeRoot, outputDir, platform, forceMacosIntel) {
    if (!fs.existsSync(outputDir)) {
        return;
    }

    [
        "builder-debug.yml",
        "builder-effective-config.yaml"
    ].forEach((fileName) => {
        removeIfExists(path.join(outputDir, fileName));
    });

    if (platform !== "macos") {
        return;
    }

    rewriteMacUpdateFeed(dialogForgeRoot, outputDir);
    const stableDmgName = `DialogQCA_${forceMacosIntel ? "intel" : "silicon"}.dmg`;

    fs.readdirSync(outputDir, { withFileTypes: true }).forEach((entry) => {
        if (entry.isDirectory()) {
            return;
        }

        const fileName = entry.name;
        const keep = fileName === stableDmgName
            || fileName === "latest-mac.yml"
            || /\.zip$/i.test(fileName)
            || /\.zip\.blockmap$/i.test(fileName);

        if (!keep) {
            removeIfExists(path.join(outputDir, fileName));
        }
    });
};

const forceMacosIntelBuildTarget = function(packagePath) {
    const packageJson = readJson(packagePath);
    const build = packageJson.build && typeof packageJson.build === "object"
        ? packageJson.build
        : {};
    const mac = build.mac && typeof build.mac === "object"
        ? build.mac
        : {};
    const targets = Array.isArray(mac.target)
        ? mac.target
        : [mac.target].filter(Boolean);

    if (targets.length === 0) {
        throw new Error("Cannot force macOS Intel packaging without build.mac.target.");
    }

    packageJson.build = build;
    packageJson.build.mac = mac;
    packageJson.build.mac.target = targets.map((target) => {
        if (!target || typeof target !== "object") {
            throw new Error("Cannot force macOS Intel packaging for a non-object macOS target.");
        }
        return Object.assign({}, target, {
            arch: ["x64"]
        });
    });

    writeJson(packagePath, packageJson);
};

const main = function() {
    const dialogForgeRoot = resolveDialogForgeRoot();
    const requestedArgs = process.argv.slice(2);
    const forceMacosIntel = requestedArgs.includes(macosIntelArgument);
    const packagingArgs = requestedArgs.filter((arg) => {
        return arg !== macosIntelArgument;
    });
    const packagePath = path.join(productRoot, "package.json");
    const originalPackageJson = fs.readFileSync(packagePath, "utf8");
    const updateReleaseTag = updateReleaseTagForBuild(packagingArgs, forceMacosIntel);
    const platform = requestedPlatform(packagingArgs);
    const outputDir = path.join(productRoot, "build/output");

    runNpm(productRoot, ["run", "check"]);

    try {
        injectAutoUpdatePolicy(packagePath, updateReleaseTag);

        if (forceMacosIntel) {
            if (process.platform !== "darwin") {
                throw new Error(`${macosIntelArgument} can only be used on macOS.`);
            }
            forceMacosIntelBuildTarget(packagePath);
        }

        runNode(dialogForgeRoot, [
            path.join(dialogForgeRoot, "scripts/build-desktop.js"),
            "--out-dir",
            path.join(productRoot, "dist"),
            "--product-path",
            productRoot,
            "--output-dir",
            outputDir,
            ...packagingArgs
        ]);
        cleanupBuildOutput(dialogForgeRoot, outputDir, platform, forceMacosIntel);
    }
    finally {
        fs.writeFileSync(packagePath, originalPackageJson);
    }
};

main();
