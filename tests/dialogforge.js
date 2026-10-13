"use strict";
const fs = require("fs");
const path = require("path");

const candidates = [
    process.env.DIALOGFORGE_ROOT,
    path.resolve(__dirname, "../../DialogForge"),
    path.resolve(__dirname, "../.."),
    path.resolve(__dirname, "../../DialogForge")
].filter(Boolean);

const dialogForgeRoot = candidates.find((candidate) => {
    return fs.existsSync(path.join(candidate, "src"));
});

if (!dialogForgeRoot) {
    throw new Error(
        "Could not locate DialogForge. Set DIALOGFORGE_ROOT to the DialogForge checkout."
    );
}

const dialogForgeModule = function(relativePath) {
    if (relativePath.startsWith("shared/")) {
        const distModule = path.join(
            dialogForgeRoot,
            "dist",
            "src",
            relativePath.slice("shared/".length)
        );

        if (fs.existsSync(`${distModule}.js`)) {
            return distModule;
        }

        return path.join(dialogForgeRoot, "src", relativePath.slice("shared/".length));
    }

    return path.join(dialogForgeRoot, relativePath);
};

const registerTypeScriptRequireHook = function() {
    if (require.extensions[".ts"]) {
        return;
    }

    const candidates = [
        path.join(path.resolve(__dirname, ".."), "node_modules/typescript"),
        path.join(dialogForgeRoot, "node_modules/typescript")
    ];
    const typeScriptPath = candidates.find((candidate) => {
        return fs.existsSync(path.join(candidate, "package.json"));
    });

    if (!typeScriptPath) {
        return;
    }

    const ts = require(typeScriptPath);

    require.extensions[".ts"] = function(module, filename) {
        const source = fs.readFileSync(filename, "utf8");
        const output = ts.transpileModule(source, {
            compilerOptions: {
                target: ts.ScriptTarget.ES2022,
                module: ts.ModuleKind.CommonJS,
                esModuleInterop: true
            },
            fileName: filename
        });

        module._compile(output.outputText, filename);
    };
};

const productModule = function(relativePath) {
    const sourceModule = path.join(
        path.resolve(__dirname, ".."),
        `${relativePath}.ts`
    );

    if (fs.existsSync(sourceModule)) {
        registerTypeScriptRequireHook();
        return sourceModule;
    }

    const distModule = path.join(
        dialogForgeRoot,
        "dist",
        "products",
        "DialogQCA",
        relativePath
    );

    if (fs.existsSync(`${distModule}.js`)) {
        return distModule;
    }

    return path.join(path.resolve(__dirname, ".."), relativePath);
};

module.exports = {
    dialogForgeRoot,
    dialogForgeModule,
    productModule
};
