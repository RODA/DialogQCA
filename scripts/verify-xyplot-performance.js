"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");


const productRoot = path.resolve(__dirname, "..");
const dialogForgeRoot = path.resolve(productRoot, "../DialogForge");
const { _electron } = require(path.join(
    dialogForgeRoot,
    "node_modules/playwright"
));
const {
    findMainWindowPage,
    productLaunchArgs
} = require(path.join(
    dialogForgeRoot,
    "tests/electron/product-launch"
));
const electronExecutable = require(path.join(
    dialogForgeRoot,
    "node_modules/electron"
));
const mainEntry = path.join(
    dialogForgeRoot,
    "dist/scripts/electron-main.js"
);


const waitForRuntime = async function(page) {
    await page.waitForFunction(() => {
        const input = document.getElementById("visibleCommandInput");

        return document.body.dataset.dialogForgeReady === "1"
            && Boolean(input?.dialogForgeConsoleInputView);
    }, undefined, {
        timeout: 30000
    });
    await page.waitForFunction(() => {
        const prompts = Array.from(document.querySelectorAll(
            '#consoleTerminal [data-session-phase="ready"]'
        ));
        const prompt = prompts[prompts.length - 1];

        return Boolean(
            prompt
            && prompt.dataset.runtimeBusy !== "true"
            && prompt.style.display !== "none"
        );
    }, undefined, {
        timeout: 30000
    });
    await page.waitForFunction(async () => {
        const result = await window.dialogForge.executeInvisibleQuery({
            query: '"package:QCA" %in% search()',
            source: "electron.xyplot-performance.package-readiness"
        });

        return result.status === "ready" && result.value === true;
    }, undefined, {
        timeout: 30000,
        polling: 200
    });
};


const submitConsoleCommand = function(page, command) {
    return page.evaluate(async (commandText) => {
        const input = document.getElementById("visibleCommandInput");
        const view = input?.dialogForgeConsoleInputView;

        if (!view) {
            throw new Error("DialogForge console input is not ready.");
        }

        view.setText(commandText);
        view.focus();
        await view.submit();
    }, command);
};


const waitForWorkspaceObjects = async function(page, names) {
    await page.waitForFunction(async (expected) => {
        const workspace = await window.dialogForge.refreshWorkspace();
        const available = new Set(workspace.objects.map((object) => object.name));

        return expected.every((name) => available.has(name));
    }, names, {
        timeout: 30000,
        polling: 200
    });
};


const clickContainerItem = async function(page, controlName, value) {
    const item = page.locator(
        `.dm-el[data-control-name=${JSON.stringify(controlName)}] `
        + `.container-item[data-value=${JSON.stringify(value)}]`
    ).first();

    await item.waitFor({
        state: "visible",
        timeout: 30000
    });
    await item.click();
};


const installCanvasCounters = function(page) {
    return page.evaluate(() => {
        const metrics = window;

        metrics.__xyArcCount = 0;
        metrics.__xyFillTextCount = 0;

        if (metrics.__xyCanvasCountersInstalled) {
            return;
        }

        metrics.__xyCanvasCountersInstalled = true;
        const originalArc = CanvasRenderingContext2D.prototype.arc;
        const originalFillText = CanvasRenderingContext2D.prototype.fillText;

        CanvasRenderingContext2D.prototype.arc = function(...args) {
            metrics.__xyArcCount += 1;
            return originalArc.apply(this, args);
        };
        CanvasRenderingContext2D.prototype.fillText = function(...args) {
            metrics.__xyFillTextCount += 1;
            return originalFillText.apply(this, args);
        };
    });
};


const resetCanvasCounters = function(page) {
    return page.evaluate(() => {
        window.__xyArcCount = 0;
        window.__xyFillTextCount = 0;
    });
};


const waitForPlotReady = async function(page, pointCount, dataKeyPrefix = "") {
    try {
        await page.waitForFunction(({ expectedCount, expectedKey }) => {
            const canvas = document.querySelector(
                '.dm-el[data-control-name="plot_xy"] canvas'
            );

            return canvas?.getAttribute("data-loading") === "false"
                && Number(canvas.getAttribute("data-point-count")) === expectedCount
                && String(canvas.getAttribute("data-data-key") || "")
                    .startsWith(expectedKey);
        }, {
            expectedCount: pointCount,
            expectedKey: dataKeyPrefix
        }, {
            timeout: 30000
        });
    }
    catch (error) {
        const diagnostic = await page.evaluate(() => {
            const canvas = document.querySelector(
                '.dm-el[data-control-name="plot_xy"] canvas'
            );
            const selected = document.querySelector(
                '.dm-el[data-control-name="c_datasets"] .container-item.active'
            );

            return {
                loading: canvas?.getAttribute("data-loading"),
                pointCount: canvas?.getAttribute("data-point-count"),
                dataKey: canvas?.getAttribute("data-data-key"),
                selectedDataset: selected?.getAttribute("data-value")
            };
        });

        throw new Error(
            `XY plot did not finish ${pointCount} points: ${JSON.stringify(diagnostic)}`,
            { cause: error }
        );
    }
};


const measureToolbarToggle = function(page, label) {
    return page.evaluate((buttonLabel) => {
        const button = Array.from(document.querySelectorAll(
            '[role="toolbar"] button'
        )).find((candidate) => {
            return candidate.getAttribute("aria-label") === buttonLabel
                || String(candidate.textContent || "").trim() === buttonLabel;
        });

        if (!(button instanceof HTMLButtonElement)) {
            throw new Error(`Missing XY toolbar button ${buttonLabel}.`);
        }

        window.__xyArcCount = 0;
        window.__xyFillTextCount = 0;
        const startedAt = performance.now();

        button.click();

        return {
            elapsedMs: performance.now() - startedAt,
            arcs: window.__xyArcCount,
            textDraws: window.__xyFillTextCount
        };
    }, label);
};


const chooseZoom = function(page, zoom) {
    return page.evaluate((value) => {
        const menuButton = document.querySelector(
            'button[aria-label="Set the plot zoom"]'
        );

        if (!(menuButton instanceof HTMLButtonElement)) {
            throw new Error("Missing XY zoom button.");
        }

        menuButton.click();
        const item = Array.from(document.querySelectorAll(
            '[role="menuitemradio"]'
        )).find((candidate) => {
            return Number(candidate.getAttribute("data-zoom")) === value;
        });

        if (!(item instanceof HTMLButtonElement)) {
            throw new Error(`Missing ${value * 100}% XY zoom item.`);
        }

        item.click();
    }, zoom);
};


const readViewport = function(page) {
    return page.evaluate(() => {
        const canvas = document.querySelector(
            '.dm-el[data-control-name="plot_xy"] canvas'
        );

        if (!(canvas instanceof HTMLCanvasElement)) {
            throw new Error("Missing XY plot canvas.");
        }

        return {
            xMin: Number(canvas.dataset.viewportXMin),
            xMax: Number(canvas.dataset.viewportXMax),
            yMin: Number(canvas.dataset.viewportYMin),
            yMax: Number(canvas.dataset.viewportYMax),
            cursor: canvas.style.cursor
        };
    });
};


const verifyShiftPan = async function(page) {
    await chooseZoom(page, 1.5);
    const before = await readViewport(page);
    const canvas = page.locator(
        '.dm-el[data-control-name="plot_xy"] canvas'
    );
    const bounds = await canvas.boundingBox();

    assert.ok(bounds, "Missing XY plot canvas bounds.");
    const startX = bounds.x + bounds.width * 0.55;
    const startY = bounds.y + bounds.height * 0.55;

    await page.mouse.move(startX, startY);
    await page.keyboard.down("Shift");
    assert.equal((await readViewport(page)).cursor, "grab");
    await page.mouse.down();
    assert.equal((await readViewport(page)).cursor, "grabbing");
    await page.mouse.move(startX - 80, startY - 45);
    const after = await readViewport(page);

    assert.ok(after.xMin > before.xMin, "Dragging left did not pan the viewport right.");
    assert.ok(after.yMin < before.yMin, "Dragging up did not pan the viewport down.");
    assert.ok(after.xMax <= 1 && after.yMin >= 0, "Panning escaped the data bounds.");
    await page.mouse.up();
    assert.equal((await readViewport(page)).cursor, "grab");
    await page.keyboard.up("Shift");
    assert.equal((await readViewport(page)).cursor, "crosshair");
    await chooseZoom(page, 1);
};


const verifyRectangleZoom = async function(page) {
    await chooseZoom(page, 1);
    const canvas = page.locator(
        '.dm-el[data-control-name="plot_xy"] canvas'
    );
    const bounds = await canvas.boundingBox();

    assert.ok(bounds, "Missing XY plot canvas bounds.");
    await page.mouse.move(
        bounds.x + bounds.width * 0.35,
        bounds.y + 1
    );
    await page.mouse.down();
    await page.mouse.move(
        bounds.x + bounds.width * 0.72,
        bounds.y + bounds.height * 0.62,
        { steps: 5 }
    );
    await page.mouse.up();
    const viewport = await readViewport(page);

    assert.ok(
        viewport.xMax - viewport.xMin < 0.8,
        "Rectangle selection did not zoom the X viewport."
    );
    assert.ok(
        viewport.yMax - viewport.yMin < 0.8,
        "Rectangle selection did not zoom the Y viewport."
    );
    assert.ok(
        Math.abs(viewport.yMax - 1) < 1e-8,
        "A rectangle begun above the plot did not clamp to its top edge: "
            + JSON.stringify(viewport)
    );
    await chooseZoom(page, 1);
};


const run = async function() {
    const originalCwd = process.cwd();
    const testUserDataPath = fs.mkdtempSync(path.join(
        os.tmpdir(),
        "dialogqca-xyplot-performance-"
    ));
    let app;

    process.env.DIALOGFORGE_ELECTRON_PRODUCT_PATH = productRoot;
    process.chdir(dialogForgeRoot);

    try {
        app = await _electron.launch({
            executablePath: electronExecutable,
            args: productLaunchArgs(mainEntry),
            cwd: dialogForgeRoot,
            env: {
                ...process.env,
                DIALOGFORGE_TEST_USER_DATA_PATH: testUserDataPath
            }
        });
        const mainPage = await findMainWindowPage(app);

        await waitForRuntime(mainPage);
        await submitConsoleCommand(mainPage, [
            'data(LF, package = "QCA")',
            "set.seed(1)",
            "LF5000 <- LF[sample(seq_len(nrow(LF)), 5000, replace = TRUE), , drop = FALSE]"
        ].join("; "));
        await waitForWorkspaceObjects(mainPage, ["LF5000"]);
        const activeDataset = await mainPage.evaluate(async () => {
            return await window.dialogForge.setActiveDataset("LF5000");
        });
        assert.equal(activeDataset.objectName, "LF5000");

        const dialogPromise = app.waitForEvent("window", {
            timeout: 10000
        });
        const openResult = await mainPage.evaluate(() => {
            return window.dialogForge.openProductDialog("xyplot");
        });

        assert.equal(openResult.status, "opened");
        const dialogPage = await dialogPromise;

        await dialogPage.waitForSelector(
            '.dm-el[data-control-name="plot_xy"] canvas',
            { timeout: 30000 }
        );
        await dialogPage.waitForFunction(() => {
            const selected = document.querySelector(
                '.dm-el[data-control-name="c_datasets"] '
                + '.container-item[data-value="LF5000"].active'
            );

            return Boolean(selected);
        }, undefined, {
            timeout: 30000
        });
        await dialogPage.waitForTimeout(1500);
        const parametersFocused = await dialogPage.evaluate(() => {
            const control = document.querySelector(
                '.dm-el[data-control-name="pof"]'
            );

            return Boolean(control?.contains(document.activeElement));
        });

        assert.equal(
            parametersFocused,
            false,
            "The parameters-of-fit checkbox retained initial focus."
        );
        await installCanvasCounters(dialogPage);
        await waitForPlotReady(dialogPage, 0, "LF5000::");

        await clickContainerItem(dialogPage, "c_x", "URB");
        await waitForPlotReady(dialogPage, 0, "LF5000::URB::");
        await resetCanvasCounters(dialogPage);
        const startedAt = Date.now();

        await clickContainerItem(dialogPage, "c_y", "STB");
        await waitForPlotReady(dialogPage, 5000, "LF5000::URB::STB::");

        const dataAndDrawMs = Date.now() - startedAt;
        const fillOff = await measureToolbarToggle(dialogPage, "Fill");
        const fillOn = await measureToolbarToggle(dialogPage, "Fill");

        assert.equal(fillOff.arcs, 5000);
        assert.equal(fillOn.arcs, 5000);
        assert.ok(
            Math.max(fillOff.elapsedMs, fillOn.elapsedMs) < 1000,
            "LF5000 basic redraw exceeded one second."
        );

        const jitter = await measureToolbarToggle(dialogPage, "Jitter");
        const labels = await measureToolbarToggle(dialogPage, "Labels");

        assert.equal(jitter.arcs, 5000);
        assert.equal(labels.arcs, 5000);
        assert.ok(jitter.elapsedMs < 1000, "5,000-point jitter redraw exceeded one second.");
        assert.ok(labels.elapsedMs < 2000, "5,000 labeled points exceeded two seconds.");
        assert.ok(labels.textDraws >= 5000, "The label-heavy redraw did not paint every case label.");
        await verifyRectangleZoom(dialogPage);
        await verifyShiftPan(dialogPage);

        console.log(JSON.stringify({
            dataAndDraw5000Ms: dataAndDrawMs,
            redraw5000Ms: Math.max(fillOff.elapsedMs, fillOn.elapsedMs),
            jitter5000Ms: jitter.elapsedMs,
            labels5000Ms: labels.elapsedMs,
            labelsDrawn: labels.textDraws
        }, null, 2));
        console.log("DialogQCA XY plot performance verified.");
    }
    finally {
        if (app) {
            await app.close().catch(() => {});
        }
        process.chdir(originalCwd);
        fs.rmSync(testUserDataPath, {
            recursive: true,
            force: true
        });
    }
};


void run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
