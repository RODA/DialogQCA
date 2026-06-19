"use strict";
const fs = require("fs");
const path = require("path");

const candidates = [
    process.env.DIALOGFORGE_ROOT,
    path.resolve(__dirname, "../.."),
    path.resolve(__dirname, "../../DialogForge")
].filter(Boolean);

const dialogForgeRoot = candidates.find((candidate) => {
    return fs.existsSync(path.join(candidate, "shared"));
});

if (!dialogForgeRoot) {
    throw new Error(
        "Could not locate DialogForge. Set DIALOGFORGE_ROOT to the DialogForge checkout."
    );
}

const dialogForgeModule = function(relativePath) {
    return path.join(dialogForgeRoot, relativePath);
};

module.exports = {
    dialogForgeRoot,
    dialogForgeModule
};
