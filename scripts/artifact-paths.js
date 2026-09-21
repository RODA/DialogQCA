"use strict";

const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

const productDetails = function() {
    const packageJson = JSON.parse(
        fs.readFileSync(path.join(projectRoot, "package.json"), "utf8")
    );
    const product = packageJson.product && typeof packageJson.product === "object"
        ? packageJson.product
        : {};
    const name = String(product.name || product.id || packageJson.name || "DialogR").trim();
    const id = String(product.id || name).trim();

    return {
        id,
        name,
        fileName: name.replace(/\s+/g, "_"),
        envPrefix: id.replace(/[^a-z0-9]/gi, "").toUpperCase()
    };
};

const productDmgPaths = function({ required = true } = {}) {
    const details = productDetails();
    const outputDir = path.join(projectRoot, "build", "output");
    const candidates = [
        path.join(outputDir, `${details.fileName}_silicon.dmg`),
        path.join(outputDir, `${details.fileName}_intel.dmg`)
    ];
    const paths = candidates.filter((candidate) => fs.existsSync(candidate));

    if (required && paths.length === 0) {
        throw new Error(`Missing built DMG: looked for ${candidates.join(" and ")}`);
    }

    return paths;
};

const updateChannelPaths = function() {
    const outputDir = path.join(projectRoot, "build", "output");
    if (!fs.existsSync(outputDir)) {
        return [];
    }

    return fs.readdirSync(outputDir)
        .filter((name) => {
            return /-mac\.yml$/i.test(name)
                || /-mac\.zip$/i.test(name)
                || /-mac\.zip\.blockmap$/i.test(name);
        })
        .sort()
        .map((name) => path.join(outputDir, name));
};

const productAppPaths = function() {
    const details = productDetails();
    const outputDir = path.join(projectRoot, "build", "output");
    if (!fs.existsSync(outputDir)) {
        return [];
    }

    return fs.readdirSync(outputDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name.startsWith("mac"))
        .map((entry) => path.join(outputDir, entry.name, `${details.name}.app`))
        .filter((candidate) => fs.existsSync(candidate));
};

const updateChannelMetadataPaths = function() {
    return updateChannelPaths().filter((candidate) => candidate.endsWith("-mac.yml"));
};

const archForChannelMetadata = function(channelPath) {
    const match = /^latest-([a-z0-9_]+)-mac\.yml$/i.exec(path.basename(channelPath));
    return match ? match[1].toLowerCase() : null;
};

const productAppPathForArch = function(arch) {
    const directories = {
        arm64: "mac-arm64",
        x64: "mac",
        universal: "mac-universal"
    };
    const directory = directories[arch];
    if (!directory) {
        return null;
    }

    const details = productDetails();
    const candidate = path.join(
        projectRoot,
        "build",
        "output",
        directory,
        `${details.name}.app`
    );
    return fs.existsSync(candidate) ? candidate : null;
};

module.exports = {
    projectRoot,
    productDetails,
    productDmgPaths,
    productAppPaths,
    productAppPathForArch,
    updateChannelPaths,
    updateChannelMetadataPaths,
    archForChannelMetadata
};
