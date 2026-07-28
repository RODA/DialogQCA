"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const productRoot = path.resolve(__dirname, "..");
const macosIntelArgument = "--macos-intel";

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

const runNode = function(cwd, args, env = process.env) {
    const result = spawnSync(process.execPath, args, {
        cwd,
        env,
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

const readRequiredReleaseTags = function(packagePath) {
    const packageJson = readJson(packagePath);
    const releaseTags = packageJson.product && typeof packageJson.product === "object"
        ? packageJson.product.releaseTags
        : null;
    const normalized = releaseTags && typeof releaseTags === "object"
        ? {
            linuxIntel: String(releaseTags.linuxIntel || "").trim(),
            windowsIntel: String(releaseTags.windowsIntel || "").trim(),
            macosIntel: String(releaseTags.macosIntel || "").trim(),
            macosSilicon: String(releaseTags.macosSilicon || "").trim(),
            webrVFS: String(releaseTags.webrVFS || "").trim()
        }
        : null;

    if (!normalized
        || !normalized.linuxIntel
        || !normalized.windowsIntel
        || !normalized.macosIntel
        || !normalized.macosSilicon
        || !normalized.webrVFS) {
        throw new Error(
            "Missing package.json product.releaseTags. Expected linuxIntel, windowsIntel, " +
            "macosIntel, macosSilicon, and webrVFS."
        );
    }

    return normalized;
};

const updateReleaseTagForBuild = function(packagePath, args, forceMacosIntel) {
    const updateReleaseTags = readRequiredReleaseTags(packagePath);
    const platform = requestedPlatform(args);

    if (platform === "linux") {
        return updateReleaseTags.linuxIntel;
    }
    if (platform === "windows") {
        return updateReleaseTags.windowsIntel;
    }
    if (platform === "macos") {
        return forceMacosIntel
            ? updateReleaseTags.macosIntel
            : updateReleaseTags.macosSilicon;
    }

    return updateReleaseTags.macosSilicon;
};

const parseGitHubRepository = function(remoteUrl) {
    const trimmedUrl = String(remoteUrl || "").trim();
    const match = trimmedUrl.match(
        /github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i
    );

    if (!match) {
        return "";
    }

    return `${match[1]}/${match[2]}`;
};

const readConfiguredReleaseRepository = function(packageJson) {
    return String(packageJson.product?.autoUpdate?.releaseRepository || "").trim();
};

const inferReleaseRepositoryFromGit = function() {
    const githubRepository = String(process.env.GITHUB_REPOSITORY || "").trim();
    if (githubRepository) {
        return githubRepository;
    }

    const result = spawnSync("git", ["config", "--get", "remote.origin.url"], {
        cwd: productRoot,
        env: process.env,
        encoding: "utf8"
    });

    if (result.error) {
        return "";
    }

    if (result.status !== 0) {
        return "";
    }

    return parseGitHubRepository(result.stdout);
};

const resolveReleaseRepository = function(packagePath) {
    const packageJson = readJson(packagePath);
    const configuredRepository = readConfiguredReleaseRepository(packageJson);

    if (configuredRepository) {
        return configuredRepository;
    }

    const inferredRepository = inferReleaseRepositoryFromGit();

    if (inferredRepository) {
        return inferredRepository;
    }

    throw new Error(
        "Could not resolve product.autoUpdate.releaseRepository. " +
        "Set product.autoUpdate.releaseRepository in package.json or configure " +
        "a GitHub remote.origin.url for this repository."
    );
};

const rewriteMacUpdateFeed = function(dialogForgeRoot, outputDir) {
    const latestPath = path.join(outputDir, "latest-mac.yml");
    if (!fs.existsSync(latestPath)) {
        return "";
    }

    const yaml = require(path.join(dialogForgeRoot, "node_modules/js-yaml"));
    const latest = yaml.load(fs.readFileSync(latestPath, "utf8")) || {};
    const files = Array.isArray(latest.files) ? latest.files : [];
    const zipEntry = files.find((entry) => {
        return /\.zip$/i.test(String((entry || {}).url || ""));
    });

    if (!zipEntry) {
        return "";
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

    return zipName;
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

    const currentZipName = rewriteMacUpdateFeed(dialogForgeRoot, outputDir);
    const stableDmgName = `DialogQCA_${forceMacosIntel ? "intel" : "silicon"}.dmg`;

    fs.readdirSync(outputDir, { withFileTypes: true }).forEach((entry) => {
        if (entry.isDirectory()) {
            return;
        }

        const fileName = entry.name;
        const keep = fileName === stableDmgName
            || fileName === "latest-mac.yml"
            || (currentZipName && fileName === currentZipName)
            || (currentZipName && fileName === `${currentZipName}.blockmap`);

        if (!keep) {
            removeIfExists(path.join(outputDir, fileName));
        }
    });
};

const main = function() {
    const dialogForgeRoot = resolveDialogForgeRoot();
    const requestedArgs = process.argv.slice(2);
    const forceMacosIntel = requestedArgs.includes(macosIntelArgument);
    const packagingArgs = requestedArgs.filter((arg) => {
        return arg !== macosIntelArgument;
    });
    const packagePath = path.join(productRoot, "package.json");
    const updateReleaseTag = updateReleaseTagForBuild(packagePath, packagingArgs, forceMacosIntel);
    const releaseRepository = resolveReleaseRepository(packagePath);
    const platform = requestedPlatform(packagingArgs);
    const outputDir = path.join(productRoot, "build/output");
    const packagingEnv = Object.assign({}, process.env, {
        DIALOGFORGE_RELEASE_REPOSITORY: releaseRepository,
        DIALOGFORGE_RELEASE_TAG: updateReleaseTag
    });

    runNpm(productRoot, ["run", "check"]);

    if (forceMacosIntel && process.platform !== "darwin") {
        throw new Error(`${macosIntelArgument} can only be used on macOS.`);
    }

    runNode(dialogForgeRoot, [
        path.join(dialogForgeRoot, "scripts/build-desktop.js"),
        "--out-dir",
        path.join(productRoot, "dist"),
        "--product-path",
        productRoot,
        "--output-dir",
        outputDir,
        ...(forceMacosIntel ? ["--arch", "x64"] : []),
        ...packagingArgs
    ], packagingEnv);
    cleanupBuildOutput(dialogForgeRoot, outputDir, platform, forceMacosIntel);
};

main();
