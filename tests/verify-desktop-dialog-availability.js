"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { dialogForgeRoot } = require("./dialogforge");
const { _electron } = require(path.join(dialogForgeRoot, "node_modules/playwright"));
const { findMainWindowPage } = require(path.join(dialogForgeRoot, "tests/electron/product-launch"));

const productRoot = path.resolve(__dirname, "..");
const sourceFiles = ["package.json", "menu/menu.json", "dialogs/dialogs.json"];
const originalSources = sourceFiles.map((file) => fs.readFileSync(path.join(productRoot, file), "utf8"));
const expected = JSON.parse(originalSources[0]).product.dialogAvailability.fiss;

const runNode = function(args, env) {
    const result = spawnSync(process.execPath, args, {
        cwd: dialogForgeRoot,
        env,
        stdio: "inherit"
    });
    if (result.error) {
        throw result.error;
    }
    assert.equal(result.status, 0, `Command failed: ${args.join(" ")}`);
};

async function inspectDesktop(stagedRoot, distRoot, fissAvailable) {
    const registry = JSON.parse(fs.readFileSync(path.join(stagedRoot, "dialogs/dialogs.json"), "utf8"));
    assert.equal(registry.some((dialog) => dialog.id === "fiss"), fissAvailable);
    assert(registry.some((dialog) => dialog.id === "venn"));
    const userData = fs.mkdtempSync(path.join(os.tmpdir(), "dialog-profile-user-"));
    const app = await _electron.launch({
        executablePath: require(path.join(dialogForgeRoot, "node_modules/electron")),
        // Launch the same generated entry point used by the desktop package.
        args: [path.join(distRoot, "scripts/electron-main-product-DialogQCA.js")],
        cwd: distRoot,
        env: { ...process.env, DIALOGFORGE_TEST_USER_DATA_PATH: userData }
    });
    try {
        console.log(`Inspecting desktop profile: Fiss=${fissAvailable}`);
        const page = await findMainWindowPage(app);
        page.setDefaultTimeout(30000);
        await page.waitForFunction(() => {
            const prompt = [...document.querySelectorAll('#consoleTerminal [data-session-phase="ready"]')].at(-1);
            return prompt && prompt.dataset.runtimeBusy !== "true" && !document.body.classList.contains("console-cover-visible");
        }, null, { timeout: 60000 });
        console.log("Desktop runtime ready");
        const menu = await app.evaluate(({ Menu }) => {
            const application = Menu.getApplicationMenu();
            return {
                fiss: Boolean(application.getMenuItemById("QcaFiss")),
                venn: Boolean(application.getMenuItemById("QcaVenn")),
                xyplot: Boolean(application.getMenuItemById("QcaXyPlot"))
            };
        });
        assert.deepEqual(menu, { fiss: fissAvailable, venn: true, xyplot: true });
        const opened = app.waitForEvent("window");
        await app.evaluate(({ Menu }, id) => {
            const item = Menu.getApplicationMenu().getMenuItemById(id);
            if (!item.enabled) throw new Error(`Menu item ${id} is disabled`);
            item.click();
        }, fissAvailable ? "QcaFiss" : "QcaVenn");
        const dialog = await opened;
        await dialog.getByText(fissAvailable ? "Intermediate solution:" : "custom", { exact: true }).waitFor();
        await dialog.locator(".plot-dialog-window-toolbar").waitFor();
        await dialog.close();
    } catch (error) {
        console.error("Desktop profile check failed:", error);
        throw error;
    } finally {
        const child = app.process();
        let shutdownTimedOut = false;
        const timeout = setTimeout(() => {
            shutdownTimedOut = true;
            child.kill("SIGKILL");
        }, 15000);
        try {
            await app.close();
        } finally {
            clearTimeout(timeout);
        }
        assert.equal(shutdownTimedOut, false, "Desktop app did not shut down normally");
        fs.rmSync(userData, { recursive: true, force: true });
    }
}

async function main() {
    fs.mkdirSync(path.join(productRoot, "dist"), { recursive: true });
    const distRoot = fs.mkdtempSync(path.join(productRoot, "dist/dialog-profile-"));
    const env = {
        ...process.env,
        DIALOGFORGE_SOURCE_ROOT: dialogForgeRoot,
        DIALOGFORGE_DIST_DIR: distRoot
    };
    try {
        runNode([path.join(dialogForgeRoot, "scripts/build-desktop.js"), "--out-dir", distRoot], env);
        const packagingScript = path.join(distRoot, "scripts/package-product.js");
        const args = [packagingScript, "--product-path", productRoot, "--stage-only"];
        // Ordinary start/dev staging defaults to development without an override.
        runNode(args, env);
        await inspectDesktop(path.join(distRoot, "product"), distRoot, expected.development);
        // Preview release filtering through the real packager without signing an installer.
        runNode([...args, "--profile", "release"], env);
        await inspectDesktop(path.join(distRoot, "product"), distRoot, expected.release);
        const rejected = spawnSync(process.execPath, [
            packagingScript, "--product-path", productRoot, "--profile", "development"
        ], { cwd: dialogForgeRoot, env, encoding: "utf8" });
        assert.notEqual(rejected.status, 0);
        assert.match(rejected.stderr, /Desktop packages must use the release profile/);
        for (const [index, file] of sourceFiles.entries()) {
            assert.equal(fs.readFileSync(path.join(productRoot, file), "utf8"), originalSources[index]);
        }
        console.log(`PASS desktop availability: development Fiss=${expected.development}, release Fiss=${expected.release}; source registrations preserved`);
    } finally {
        fs.rmSync(distRoot, { recursive: true, force: true });
    }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
