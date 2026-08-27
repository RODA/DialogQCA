"use strict";

const fs = require("fs");
const https = require("https");
const path = require("path");
const {
    writeRPackageManifest
} = require("./generate-r-package-manifest");

const productRoot = path.resolve(__dirname, "..");
const libraryDir = path.join(productRoot, "library", "R");
const assets = [
    "library.data.gz",
    "library.js.metadata"
];

const readReleaseConfiguration = function() {
    const packageJson = JSON.parse(
        fs.readFileSync(path.join(productRoot, "package.json"), "utf8")
    );
    const product = packageJson.product && typeof packageJson.product === "object"
        ? packageJson.product
        : {};
    const library = product.webRPackageLibrary
        && typeof product.webRPackageLibrary === "object"
        ? product.webRPackageLibrary
        : {};
    const releaseRepository = String(library.releaseRepository || "").trim();
    const releaseTag = String(
        library.releaseTag || product.releaseTags?.webrVFS || ""
    ).trim();

    if (!releaseRepository || !releaseTag) {
        throw new Error(
            "Missing package.json product.webRPackageLibrary "
                + "releaseRepository or releaseTag."
        );
    }

    return { releaseRepository, releaseTag };
};

const httpsGet = function(sourceUrl, headers = {}) {
    return new Promise((resolve, reject) => {
        const request = https.get(sourceUrl, {
            headers: {
                "User-Agent": "DialogQCA-WebR-library-fetcher",
                ...headers
            }
        }, (response) => {
            if (
                response.statusCode >= 300
                && response.statusCode < 400
                && response.headers.location
            ) {
                response.resume();
                httpsGet(new URL(response.headers.location, sourceUrl).toString(), headers)
                    .then(resolve, reject);
                return;
            }

            resolve(response);
        });

        request.on("error", reject);
    });
};

const readReleaseAssets = async function(configuration) {
    const releaseTagUrl = encodeURIComponent(configuration.releaseTag);
    const response = await httpsGet(
        `https://api.github.com/repos/${configuration.releaseRepository}`
            + `/releases/tags/${releaseTagUrl}`,
        {
            Accept: "application/vnd.github+json"
        }
    );

    if (response.statusCode !== 200) {
        response.resume();
        throw new Error(
            "Could not read WebR package library release metadata for "
                + `${configuration.releaseTag}: HTTP ${response.statusCode}`
        );
    }

    const chunks = [];

    for await (const chunk of response) {
        chunks.push(chunk);
    }

    const release = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const releaseAssets = Array.isArray(release.assets) ? release.assets : [];

    return new Map(releaseAssets.map((asset) => [String(asset.name || ""), asset]));
};

const isLocalReleaseAssetCurrent = function(targetPath, asset) {
    if (!fs.existsSync(targetPath)) {
        return false;
    }

    const stat = fs.statSync(targetPath);
    const expectedSize = Number(asset?.size || 0);
    const updatedAt = Date.parse(String(asset?.updated_at || asset?.created_at || ""));

    if (expectedSize > 0 && stat.size !== expectedSize) {
        return false;
    }

    if (Number.isFinite(updatedAt) && stat.mtimeMs + 1000 < updatedAt) {
        return false;
    }

    return true;
};

const downloadFile = function(url, targetPath) {
    return new Promise((resolve, reject) => {
        const request = https.get(url, (response) => {
            if (
                response.statusCode >= 300
                && response.statusCode < 400
                && response.headers.location
            ) {
                response.resume();
                downloadFile(new URL(response.headers.location, url).toString(), targetPath)
                    .then(resolve, reject);
                return;
            }

            if (response.statusCode !== 200) {
                response.resume();
                reject(new Error(`Download failed for ${url}: HTTP ${response.statusCode}`));
                return;
            }

            const temporaryPath = `${targetPath}.tmp`;
            const output = fs.createWriteStream(temporaryPath);

            response.pipe(output);
            output.on("finish", () => {
                output.close(() => {
                    fs.renameSync(temporaryPath, targetPath);
                    resolve();
                });
            });
            output.on("error", (error) => {
                try {
                    fs.rmSync(temporaryPath, { force: true });
                }
                catch {}
                reject(error);
            });
        });

        request.on("error", reject);
    });
};

const touchDownloadedAsset = function(targetPath, asset) {
    const updatedAt = Date.parse(String(asset?.updated_at || asset?.created_at || ""));

    if (!Number.isFinite(updatedAt)) {
        return;
    }

    const timestamp = new Date(updatedAt);

    fs.utimesSync(targetPath, timestamp, timestamp);
};

const main = async function() {
    fs.mkdirSync(libraryDir, { recursive: true });
    const force = process.argv.includes("--force");
    const configuration = readReleaseConfiguration();
    const releaseAssets = await readReleaseAssets(configuration);

    for (const assetName of assets) {
        const targetPath = path.join(libraryDir, assetName);
        const releaseAsset = releaseAssets.get(assetName);

        if (!releaseAsset) {
            throw new Error(
                "WebR package library release asset is missing from "
                    + `${configuration.releaseTag}: ${assetName}`
            );
        }

        if (!force && isLocalReleaseAssetCurrent(targetPath, releaseAsset)) {
            console.log(`${assetName} is current.`);
            continue;
        }

        const url = String(releaseAsset.browser_download_url || "")
            || [
                `https://github.com/${configuration.releaseRepository}`
                    + "/releases/download",
                encodeURIComponent(configuration.releaseTag),
                assetName
            ].join("/");

        console.log(
            `Downloading ${assetName} from ${configuration.releaseTag}...`
        );
        await downloadFile(url, targetPath);
        touchDownloadedAsset(targetPath, releaseAsset);
    }

    const manifestResult = writeRPackageManifest(libraryDir);
    console.log(
        `Installed package manifest written to ${manifestResult.targetPath}`
    );
    console.log(`WebR package library written to ${libraryDir}`);
};

main().catch((error) => {
    const configuration = (() => {
        try {
            return readReleaseConfiguration();
        }
        catch {
            return {
                releaseRepository: "(missing)",
                releaseTag: "(missing)"
            };
        }
    })();
    console.error(
        `WebR package library lookup expects release tag "${configuration.releaseTag}" `
            + `in ${configuration.releaseRepository}.`
    );
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
