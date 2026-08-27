"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const productRoot = path.resolve(__dirname, "..");
const dialogForgeRoot = path.resolve(
    process.env.DIALOGFORGE_ROOT || path.join(productRoot, "../DialogForge")
);
const typeScriptCandidates = [
    path.join(productRoot, "node_modules/typescript"),
    path.join(dialogForgeRoot, "node_modules/typescript")
];
const typeScriptPath = typeScriptCandidates.find((candidate) => {
    return fs.existsSync(path.join(candidate, "package.json"));
});

if (!typeScriptPath) {
    throw new Error(
        `TypeScript is required for the package compatibility tests. Checked: ${typeScriptCandidates.join(", ")}`
    );
}

if (!require.extensions[".ts"]) {
    const ts = require(typeScriptPath);

    require.extensions[".ts"] = function(module, fileName) {
        const source = fs.readFileSync(fileName, "utf8");
        const output = ts.transpileModule(source, {
            compilerOptions: {
                target: ts.ScriptTarget.ES2022,
                module: ts.ModuleKind.CommonJS,
                esModuleInterop: true
            },
            fileName
        });

        module._compile(output.outputText, fileName);
    };
}

const compatibility = require(path.join(
    dialogForgeRoot,
    "src/runtime/providers/r/dependencies/rPackageCompatibility.ts"
));
const generator = require("./generate-r-package-manifest");
const productMetadata = JSON.parse(fs.readFileSync(
    path.join(productRoot, "package.json"),
    "utf8"
));
const productId = String(
    productMetadata.product?.id || productMetadata.name || "Product"
);


const verifyVersioningAndResolution = function() {
    assert.strictEqual(
        compatibility.compareRVersions("1.10.0", "1.9.9"),
        1
    );
    assert.strictEqual(
        compatibility.compareRVersions("1.0-10", "1.0-2"),
        1
    );
    assert.strictEqual(
        compatibility.compareRVersions("1.0", "1.0.0"),
        0
    );

    assert.throws(() => {
        compatibility.normalizeRPackageRequirements(["statistics"]);
    }, /structured objects/);

    assert.deepStrictEqual(
        compatibility.normalizeRPackageRequirements([
            { name: "statistics", minimumVersion: "0.13" },
            { name: "statistics", minimumVersion: "0.14" },
            { name: "admisc" }
        ]),
        [
            { name: "statistics", minimumVersion: "0.14" },
            { name: "admisc" }
        ]
    );

    const result = compatibility.resolveRPackageCompatibility([
        { name: "statistics", minimumVersion: "0.14" },
        { name: "admisc", minimumVersion: "0.40" },
        { name: "declared", minimumVersion: "0.27" }
    ], {
        schemaVersion: 1,
        packages: {
            statistics: { version: "0.13" },
            admisc: { version: "0.41" }
        }
    });

    assert.strictEqual(result.compatible, false);
    assert.deepStrictEqual(
        result.packages.map((entry) => entry.status),
        ["too-old", "satisfied", "missing"]
    );
    assert.match(
        compatibility.createRPackageCompatibilityMessage(result),
        /statistics: requires 0\.14 or newer; installed 0\.13\./
    );

    assert.deepStrictEqual(
        compatibility.parseRPackageVersions(
            "statistics\t1.0-10\nmissing\t<missing>"
        ),
        {
            schemaVersion: 1,
            packages: {
                statistics: { version: "1.0-10" }
            }
        }
    );
};


const verifyRegistryAndManifest = function() {
    const registry = JSON.parse(fs.readFileSync(
        path.join(productRoot, "dialogs/dialogs.json"),
        "utf8"
    ));
    const libraryDir = path.join(productRoot, "library/R");
    const installedManifest = compatibility.readInstalledRPackageManifest(
        fs.readFileSync(
            path.join(libraryDir, "package-manifest.json"),
            "utf8"
        )
    );

    registry.forEach((dialog) => {
        assert.strictEqual(
            Object.prototype.hasOwnProperty.call(
                dialog,
                "rPackageRequirements"
            ),
            false,
            `${dialog.id} must use the shared rPackages contract.`
        );

        (dialog.rPackages || []).forEach((requirement) => {
            assert.ok(
                requirement
                && typeof requirement === "object"
                && !Array.isArray(requirement)
                && requirement.name,
                `${dialog.id} must declare structured R package requirements.`
            );
        });

        const requirements = compatibility.normalizeRPackageRequirements(
            dialog.rPackages || []
        );
        const result = compatibility.resolveRPackageCompatibility(
            requirements,
            installedManifest
        );

        assert.strictEqual(
            result.compatible,
            true,
            `${dialog.id} has unsatisfied package requirements:\n${compatibility.createRPackageCompatibilityMessage(result)}`
        );
    });

    const metadataPath = path.join(libraryDir, "library.js.metadata");
    const dataPath = path.join(libraryDir, "library.data.gz");

    assert.strictEqual(
        fs.existsSync(metadataPath),
        fs.existsSync(dataPath),
        "The WebR VFS data and metadata files must be present together."
    );

    if (fs.existsSync(metadataPath)) {
        assert.deepStrictEqual(
            generator.generateRPackageManifest(libraryDir),
            installedManifest
        );
    }
};


const verifyProductRequirementSources = function() {
    const registry = JSON.parse(fs.readFileSync(
        path.join(productRoot, "dialogs/dialogs.json"),
        "utf8"
    ));
    const settings = JSON.parse(fs.readFileSync(
        path.join(productRoot, "settings/settings.json"),
        "utf8"
    ));
    const capabilities = JSON.parse(fs.readFileSync(
        path.join(productRoot, "capabilities/product-capabilities.json"),
        "utf8"
    ));
    const registryById = new Map(registry.map((dialog) => {
        return [dialog.id, dialog];
    }));
    const assertDeclared = function(dialogId, packageNames, source) {
        const dialog = registryById.get(dialogId);

        assert.ok(dialog, `${source} references unknown dialog ${dialogId}.`);
        const declaredNames = new Set(
            compatibility.normalizeRPackageRequirements(
                dialog.rPackages || []
            ).map((requirement) => requirement.name)
        );

        packageNames.forEach((packageName) => {
            assert.ok(
                declaredNames.has(packageName),
                `${dialogId} must declare ${packageName} in dialogs.json because it is required by ${source}.`
            );
        });
    };

    Object.entries(settings.dialogRuntimeRequirements || []).forEach(
        ([dialogId, requirement]) => {
            assertDeclared(
                dialogId,
                requirement.rPackages || [],
                "settings.dialogRuntimeRequirements"
            );
        }
    );

    capabilities.forEach((capability) => {
        const marker = ".dialog.";
        const markerIndex = String(capability.capability || "").indexOf(marker);

        if (markerIndex < 0) {
            return;
        }

        assertDeclared(
            String(capability.capability).slice(markerIndex + marker.length),
            capability.rPackages || [],
            "product capability metadata"
        );
    });
};



verifyVersioningAndResolution();
verifyRegistryAndManifest();
verifyProductRequirementSources();
console.log(`${productId} R package compatibility tests passed.`);
