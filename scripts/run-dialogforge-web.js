"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const productRoot = path.resolve(__dirname, "..");
const dialogForgeRoot = path.resolve(
    process.env.DIALOGFORGE_ROOT || path.join(productRoot, "../DialogForge")
);
const productWebDist = path.join(productRoot, "dist", "web");
const forwardedArgs = process.argv.slice(2).filter((argument) => {
    return argument !== "--no-build";
});
const shouldBuild = !process.argv.includes("--no-build");

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

const run = function(command, args, options) {
    const result = spawnSync(command, args, {
        cwd: options.cwd,
        env: options.env || process.env,
        stdio: "inherit",
        shell: process.platform === "win32" && command.endsWith(".cmd")
    });

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        process.exit(result.status || 1);
    }
};

if (!fs.existsSync(path.join(dialogForgeRoot, "package.json"))) {
    throw new Error(`DialogForge root was not found: ${dialogForgeRoot}`);
}

if (shouldBuild) {
    const invocation = npmInvocation([
        "run",
        "build:web",
        "--",
        "--out-dir",
        productWebDist,
        productRoot
    ]);

    run(invocation.command, invocation.args, {
        cwd: dialogForgeRoot,
        env: Object.assign({}, process.env, {
            DIALOGFORGE_WEB_PRODUCT_PATH: productRoot
        })
    });
}

const serverScript = path.join(
    productWebDist,
    "scripts",
    "web-product-dev-server.js"
);

if (!fs.existsSync(serverScript)) {
    throw new Error(
        `DialogForge web product server was not found: ${serverScript}. ` +
        "Run without --no-build first, or build DialogForge manually."
    );
}

run(process.execPath, [
    serverScript,
    "--product-path",
    productRoot,
    ...forwardedArgs
], {
    cwd: productWebDist,
    env: Object.assign({}, process.env, {
        DIALOGFORGE_SOURCE_ROOT: dialogForgeRoot,
        DIALOGFORGE_DIST_DIR: productWebDist,
        DIALOGFORGE_WEB_PRODUCT_PATH: productRoot
    })
});
