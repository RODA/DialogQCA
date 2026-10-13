"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { dialogForgeRoot } = require("./dialogforge");
const { chromium, _electron } = require(path.join(dialogForgeRoot, "node_modules/playwright"));
const { runConsoleCommand } = require(path.join(dialogForgeRoot, "tests/support/console-interactions"));
const { openMenuItem } = require(path.join(dialogForgeRoot, "tests/support/menu-interactions"));
const productRoot = path.resolve(__dirname, "..");
const browserMode = process.argv.includes("--web");

async function waitUntil(check, message) {
    const deadline = Date.now() + 30000;
    while (!await check()) {
        assert(Date.now() < deadline, message);
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
}

async function checkSquare(dialog) {
    const metrics = await dialog.locator(".plot-dialog-viewport svg").evaluate((svg) => {
        const frame = svg.querySelector("[data-venn-frame]");
        const bounds = svg.getBoundingClientRect();
        return {
            width: svg.width.baseVal.value,
            height: svg.height.baseVal.value,
            displayWidth: bounds.width,
            displayHeight: bounds.height,
            frame: ["x", "y", "width", "height"].map((key) => Number(frame.getAttribute(key)))
        };
    });
    assert.equal(metrics.width, metrics.height);
    assert.equal(metrics.displayWidth, metrics.displayHeight);
    assert.deepEqual(metrics.frame, [0.5, 0.5, metrics.width - 1, metrics.height - 1]);
    return metrics;
}

async function checkCaseRegions(dialog) {
    const svg = dialog.locator(".plot-dialog-viewport svg");
    await waitUntil(async () => await svg.locator("[data-venn-region]").count() === 9, "Expected nine regions with cases");
    const expectedCases = {
        1: "GR,PT,ES", 2: "IT,RO", 5: "HU,PL", 6: "EE",
        22: "FI,IE", 23: "AU", 24: "FR,SE", 31: "DE", 32: "BE,CZ,NL,UK"
    };
    // Let the real hover action wait for the resized SVG to stop moving before
    // measuring positions; modal resizing also recenters the window.
    await svg.hover();
    // Read geometry only to locate an interior point. Use real pointer movement,
    // including event hit testing, rather than dispatching synthetic hover events.
    const points = await svg.evaluate((node) => {
        return [...node.querySelectorAll("[data-venn-outcome]")].map((region) => {
            const box = region.getBBox();
            for (let y = 1; y < 80; y++) {
                for (let x = 1; x < 80; x++) {
                    const px = box.x + box.width * x / 80;
                    const py = box.y + box.height * y / 80;
                    if ([[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]].every(([dx, dy]) => {
                        const point = node.createSVGPoint();
                        point.x = px + dx;
                        point.y = py + dy;
                        return region.isPointInFill(point);
                    })) {
                        return { row: region.dataset.vennRow, x: px, y: py };
                    }
                }
            }
            throw new Error(`No interior point for region ${region.dataset.vennRow}`);
        });
    });
    for (const point of points) {
        await svg.hover({ position: { x: point.x, y: point.y } });
        const tooltip = dialog.getByRole("tooltip");
        const expected = expectedCases[point.row];
        if (!expected) {
            await tooltip.waitFor({ state: "hidden" });
            continue;
        }
        await tooltip.waitFor({ state: "visible" });
        await waitUntil(async () => {
            return (await tooltip.textContent()).replace(/\s/g, "") === expected;
        }, `Region ${point.row} did not show its cases`);
        const definition = await svg.locator(`[data-venn-region][data-venn-row="${point.row}"]`).getAttribute("d");
        assert.equal(await svg.locator('path[stroke="#0000ff"]').getAttribute("d"), definition);
    }
    // Region labels must not intercept hover either.
    for (const row of Object.keys(expectedCases)) {
        const label = svg.locator(`[data-venn-label="${row}"]`);
        const point = await label.evaluate((node) => {
            const box = node.getBBox();
            return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        });
        await svg.hover({ position: point });
        await waitUntil(async () => {
            return (await dialog.getByRole("tooltip").textContent()).replace(/\s/g, "") === expectedCases[row];
        }, `Label ${row} blocked the region's cases`);
    }
    console.log("Hovered all nine regions with cases and their labels; 23 empty regions remain inactive");
}

async function exerciseDialog(dialog, resize, copySize) {
    const toolbar = dialog.locator(".plot-dialog-window-toolbar");
    const svg = dialog.locator(".plot-dialog-viewport svg");
    await svg.filter({ hasText: "DEV" }).waitFor();
    const metrics = await toolbar.evaluate((node) => ({
        width: node.getBoundingClientRect().width,
        height: node.getBoundingClientRect().height,
        windowWidth: innerWidth,
        buttons: [...node.querySelectorAll(".plot-dialog-window-controls > button, .plot-dialog-window-controls > div > button")].map((button) => ({
            title: button.title || button.textContent,
            height: button.getBoundingClientRect().height
        }))
    }));
    assert.equal(metrics.width, metrics.windowWidth);
    assert.equal(metrics.height, 34);
    assert(metrics.buttons.every((button) => button.height === 26));
    assert.deepEqual(metrics.buttons.map((button) => button.title), [
        "Reset", "Copy plot to clipboard", "Save chart", "Set the plot zoom"
    ]);
    assert.equal(await toolbar.locator(".plot-dialog-window-title").count(), 0);
    const custom = toolbar.locator('[data-control-name="custom"] [role="checkbox"]');
    const input = toolbar.locator('[data-control-name="input1"] textarea');
    const select = toolbar.locator(".venn-toolbar-controls select");
    await custom.and(dialog.locator('[aria-checked="false"]')).waitFor();
    await input.waitFor({ state: "hidden" });
    await select.selectOption("ttTwo");
    await waitUntil(async () => await svg.locator("[data-venn-outcome]").count() === 4, "Selected truth table did not update diagram");
    await select.selectOption("ttLF");
    await waitUntil(async () => await svg.locator("[data-venn-outcome]").count() === 32, "Five-condition diagram did not return");
    const original = await checkSquare(dialog);
    await checkCaseRegions(dialog);

    await custom.click();
    await input.waitFor({ state: "visible" });
    await input.fill("DEV*URB");
    await svg.locator('[data-venn-expression="DEV*URB"]').waitFor();
    // At the initial small window size, the input must fit before the buttons.
    assert(await toolbar.evaluate((node) => {
        const input = node.querySelector("textarea").getBoundingClientRect();
        const controls = node.querySelector(".plot-dialog-window-controls").getBoundingClientRect();
        return input.right <= controls.left;
    }), "Custom expression input overlaps toolbar buttons");
    await dialog.getByRole("button", { name: "Reset", exact: true }).click();
    await custom.and(dialog.locator('[aria-checked="false"]')).waitFor();
    await input.waitFor({ state: "hidden" });
    assert.equal(await input.inputValue(), "");
    await waitUntil(async () => await svg.locator("[data-venn-outcome]").count() === 4, "Reset did not restore the default chart");

    await dialog.getByRole("button", { name: "Set the plot zoom", exact: true }).click();
    await dialog.getByRole("menuitemradio", { name: "200%", exact: true }).click();
    const zoomed = await checkSquare(dialog);
    assert.equal(zoomed.displayWidth, original.width * 2);
    await dialog.getByRole("button", { name: "Copy plot to clipboard" }).click();
    await dialog.getByRole("status").filter({ hasText: "Copied" }).waitFor();
    assert.deepEqual(await copySize(), { width: original.width, height: original.height });
    await dialog.getByRole("button", { name: "Save chart", exact: true }).click();
    const format = dialog.getByRole("combobox", { name: "Save format" });
    assert.deepEqual(await format.locator("option").evaluateAll((nodes) => nodes.map((node) => node.value)), ["svg", "png", "jpeg"]);
    await format.selectOption("svg");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await dialog.getByRole("button", { name: "Reset", exact: true }).click();
    await dialog.getByRole("button", { name: "Set the plot zoom", exact: true }).filter({ hasText: "100%" }).waitFor();
    await waitUntil(async () => await select.inputValue() === "ttTwo", "Reset did not restore the default truth table");
    await waitUntil(async () => await svg.locator("[data-venn-outcome]").count() === 4, "Reset did not finish rendering the default chart");
    await select.selectOption("ttLF");
    await waitUntil(async () => await svg.locator("[data-venn-outcome]").count() === 32, "Selected chart did not finish rendering");
    await resize();
    await waitUntil(async () => (await checkSquare(dialog)).width > original.width, "Diagram did not grow after resizing");
    await checkCaseRegions(dialog);
}

async function main() {
    let app;
    let browser;
    let server;
    let mainPage;
    let dialog;
    let resize;
    let copySize;
    const errors = [];
    try {
        if (browserMode) {
            process.env.DIALOGFORGE_DIST_DIR = path.join(productRoot, "dist/web");
            process.env.DIALOGFORGE_SOURCE_ROOT = dialogForgeRoot;
            server = require(path.join(productRoot, "dist/web/scripts/web-product-dev-server.js")).createWebProductDevServer({ productPath: productRoot });
            await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
            browser = await chromium.launch();
            mainPage = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
            mainPage.on("pageerror", (error) => errors.push(error.message));
            await mainPage.goto(`http://127.0.0.1:${server.address().port}/`);
            await mainPage.waitForFunction(() => window.dialogForgeWebConsole?.session?.getSessionPhase?.() === "ready" && !document.body.classList.contains("console-cover-visible"), null, { timeout: 90000 });
        } else {
            process.chdir(dialogForgeRoot);
            process.env.DIALOGFORGE_ELECTRON_PRODUCT_PATH = productRoot;
            const { productLaunchArgs, findMainWindowPage } = require(path.join(dialogForgeRoot, "tests/electron/product-launch"));
            app = await _electron.launch({
                executablePath: require(path.join(dialogForgeRoot, "node_modules/electron")),
                args: productLaunchArgs(path.join(dialogForgeRoot, "dist/scripts/electron-main.js")),
                cwd: dialogForgeRoot,
                env: { ...process.env, DIALOGFORGE_TEST_USER_DATA_PATH: fs.mkdtempSync(path.join(os.tmpdir(), "venn-acceptance-")) }
            });
            mainPage = await findMainWindowPage(app);
            mainPage.on("pageerror", (error) => errors.push(error.message));
            await mainPage.waitForFunction(() => {
                const prompt = [...document.querySelectorAll('#consoleTerminal [data-session-phase="ready"]')].at(-1);
                return prompt && prompt.dataset.runtimeBusy !== "true" && !document.body.classList.contains("console-cover-visible");
            }, null, { timeout: 60000 });
        }
        mainPage.setDefaultTimeout(30000);
        await mainPage.getByText("To cite package QCA in publications, please use:", { exact: false }).waitFor();
        // DialogQCA loads QCA at startup. Enter the same commands a user types.
        await runConsoleCommand(mainPage, "data(LF)");
        await runConsoleCommand(mainPage, 'ttLF <- truthTable(LF, SURV, incl.cut = 0.8, sort.by = "incl", show.cases = TRUE)');
        await runConsoleCommand(mainPage, 'ttTwo <- truthTable(LF, SURV, conditions = c("DEV", "URB"), incl.cut = 0.8, show.cases = TRUE)');
        if (browserMode) {
            await openMenuItem(mainPage, "Venn diagram");
            const layer = mainPage.locator('.dialogforge-web-dialog-layer[data-dialog-id="venn"]');
            dialog = layer.frameLocator("iframe");
            resize = async () => {
                const box = await layer.locator('[data-resize-direction="corner"]').boundingBox();
                await mainPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
                await mainPage.mouse.down();
                await mainPage.mouse.move(box.x + box.width / 2 + 180, box.y + box.height / 2 + 80, { steps: 10 });
                await mainPage.mouse.up();
            };
            copySize = () => mainPage.evaluate(async () => {
                const items = await navigator.clipboard.read();
                const bitmap = await createImageBitmap(await items[0].getType("image/png"));
                return { width: bitmap.width, height: bitmap.height };
            });
        } else {
            const menu = JSON.parse(fs.readFileSync(path.join(productRoot, "menu/menu.json"), "utf8"));
            const find = (items) => {
                for (const item of items) {
                    if (item.dialog === "venn") return item.id;
                    const id = find(item.items || []);
                    if (id) return id;
                }
            };
            const opened = app.waitForEvent("window");
            await app.evaluate(({ Menu }, id) => Menu.getApplicationMenu().getMenuItemById(id).click(), find(menu));
            dialog = await opened;
            dialog.setDefaultTimeout(30000);
            dialog.on("pageerror", (error) => errors.push(error.message));
            resize = () => app.evaluate(({ BrowserWindow }) => {
                const window = BrowserWindow.getAllWindows().find((item) => item.getTitle() === "Venn diagram");
                if (!window.isResizable()) throw new Error("Venn window is not resizable");
                window.setContentSize(640, 724);
            });
            copySize = () => app.evaluate(({ clipboard }) => clipboard.readImage().getSize());
        }
        await exerciseDialog(dialog, resize, copySize);
        assert.deepEqual(errors, [], "Unexpected rendered errors");
        await (browserMode ? mainPage : dialog).screenshot({ path: path.join(os.tmpdir(), `venn-${browserMode ? "browser" : "native"}.png`) });
        console.log(`PASS ${browserMode ? "browser" : "native"}: Venn toolbar, square frame, case-region hover, custom controls, copy, zoom and resize`);
    } catch (error) {
        if (mainPage && !mainPage.isClosed()) await mainPage.screenshot({ path: path.join(os.tmpdir(), "venn-failure.png") });
        throw error;
    } finally {
        if (app) await app.close();
        if (browser) await browser.close();
        if (server) await new Promise((resolve) => server.close(resolve));
    }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
