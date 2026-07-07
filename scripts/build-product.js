"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const productRoot = path.resolve(__dirname, "..");

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

const productPackagingArgs = function(args) {
    const platformIndex = args.indexOf("--platform");
    const platform = platformIndex >= 0
        ? String(args[platformIndex + 1] || "")
        : "";

    if (platform === "macos"
        && !args.includes("--nosign")) {
        return [...args, "--nosign"];
    }

    return args;
};

const main = function() {
    const dialogForgeRoot = resolveDialogForgeRoot();
    const packagingArgs = productPackagingArgs(process.argv.slice(2));

    runNpm(productRoot, ["run", "check"]);
    runNpm(dialogForgeRoot, [
        "run",
        "build",
        "--",
        "--product-path",
        productRoot,
        ...packagingArgs
    ]);
};

main();
