"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const productRoot = path.resolve(__dirname, "..");

const readArguments = function(args) {
    let forgePath = "";
    const forwardedArgs = [];

    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];

        if (argument === "--forge-path") {
            forgePath = String(args[index + 1] || "").trim();
            if (!forgePath) {
                throw new Error("--forge-path requires a DialogForge checkout path.");
            }
            index += 1;
            continue;
        }

        if (argument.startsWith("--forge-path=")) {
            forgePath = argument.slice("--forge-path=".length).trim();
            if (!forgePath) {
                throw new Error("--forge-path requires a DialogForge checkout path.");
            }
            continue;
        }

        forwardedArgs.push(argument);
    }

    return {
        forgePath,
        forwardedArgs
    };
};

const resolveDialogForgeRoot = function(explicitPath) {
    const candidates = [
        explicitPath,
        process.env.DIALOGFORGE_ROOT || "",
        path.join(productRoot, "../DialogForge")
    ].filter(Boolean).map((candidate) => {
        return path.resolve(candidate);
    });

    const root = candidates.find((candidate) => {
        return fs.existsSync(path.join(candidate, "package.json"))
            && fs.existsSync(path.join(candidate, "scripts/start-app.js"));
    });

    if (!root) {
        throw new Error(
            "Could not find DialogForge. Pass --forge-path /path/to/DialogForge, " +
            "set DIALOGFORGE_ROOT, or keep DialogForge as a sibling checkout. Checked: " +
            candidates.join(", ")
        );
    }

    return root;
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

const main = function() {
    const options = readArguments(process.argv.slice(2));
    const dialogForgeRoot = resolveDialogForgeRoot(options.forgePath);
    const invocation = npmInvocation([
        "run",
        "dev:watch",
        "--",
        productRoot,
        "--devtools",
        ...options.forwardedArgs
    ]);
    const result = spawnSync(invocation.command, invocation.args, {
        cwd: dialogForgeRoot,
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

main();
