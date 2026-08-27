"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const productRoot = path.resolve(__dirname, "..");
const defaultLibraryDir = path.join(productRoot, "library", "R");

const readDcf = function(source) {
    const fields = {};
    let current = "";

    String(source || "").split(/\r?\n/g).forEach((line) => {
        const match = /^([^:\s][^:]*):\s*(.*)$/.exec(line);

        if (match) {
            current = match[1].trim();
            fields[current] = match[2].trim();
            return;
        }

        if (current && /^\s+/.test(line)) {
            fields[current] = `${fields[current]} ${line.trim()}`.trim();
        }
    });

    return fields;
};

const generateRPackageManifest = function(libraryDir = defaultLibraryDir) {
    const metadataPath = path.join(libraryDir, "library.js.metadata");
    const dataPath = path.join(libraryDir, "library.data.gz");
    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
    const data = zlib.gunzipSync(fs.readFileSync(dataPath));
    const descriptionFiles = Array.isArray(metadata.files)
        ? metadata.files.filter((entry) => {
            return /\/DESCRIPTION$/.test(String(entry?.filename || ""));
        })
        : [];
    const packageEntries = descriptionFiles.map((entry) => {
        const start = Number(entry.start);
        const end = Number(entry.end);

        if (
            !Number.isSafeInteger(start)
            || !Number.isSafeInteger(end)
            || start < 0
            || end <= start
            || end > data.length
        ) {
            throw new Error(
                `Invalid WebR VFS range for ${String(entry.filename || "DESCRIPTION")}.`
            );
        }

        const description = readDcf(
            data.subarray(start, end).toString("utf8")
        );
        const name = String(description.Package || "").trim();
        const version = String(description.Version || "").trim();

        if (!name || !version) {
            throw new Error(
                `WebR VFS DESCRIPTION is missing Package or Version: ${entry.filename}`
            );
        }

        return [name, { version }];
    }).sort((left, right) => {
        return left[0].localeCompare(right[0], "en");
    });
    const packages = {};

    packageEntries.forEach(([name, value]) => {
        if (packages[name]) {
            throw new Error(`Duplicate WebR VFS package DESCRIPTION: ${name}`);
        }

        packages[name] = value;
    });

    return {
        schemaVersion: 1,
        packages
    };
};

const writeRPackageManifest = function(libraryDir = defaultLibraryDir) {
    const manifest = generateRPackageManifest(libraryDir);
    const targetPath = path.join(libraryDir, "package-manifest.json");

    fs.writeFileSync(
        targetPath,
        `${JSON.stringify(manifest, null, 2)}\n`
    );

    return {
        manifest,
        targetPath
    };
};

const main = function() {
    const result = writeRPackageManifest();
    const packageCount = Object.keys(result.manifest.packages).length;

    console.log(
        `Wrote ${packageCount} installed WebR package versions to ${result.targetPath}`
    );
};

if (require.main === module) {
    main();
}

module.exports = {
    generateRPackageManifest,
    readDcf,
    writeRPackageManifest
};
