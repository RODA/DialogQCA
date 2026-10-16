"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { dialogForgeRoot: forge } = require("./dialogforge");
const product = path.resolve(__dirname, "..");
const { _electron } = require(path.join(forge, "node_modules/playwright"));
const { productLaunchArgs, findMainWindowPage } = require(path.join(forge, "tests/electron/product-launch"));
const { runConsoleCommand } = require(path.join(forge, "tests/support/console-interactions"));

async function main() {
    process.chdir(forge);
    process.env.DIALOGFORGE_ELECTRON_PRODUCT_PATH = product;
    const app = await _electron.launch({
        executablePath: require(path.join(forge, "node_modules/electron")),
        args: productLaunchArgs(path.join(forge, "dist/scripts/electron-main.js")),
        cwd: forge,
        env: { ...process.env, DIALOGFORGE_TEST_USER_DATA_PATH: fs.mkdtempSync(path.join(os.tmpdir(), "incoherent-acceptance-")) }
    });
    let page;
    let dialog;
    const errors = [];
    try {
        page = await findMainWindowPage(app);
        page.setDefaultTimeout(30000);
        page.on("pageerror", error => errors.push(error.message));
        await page.waitForFunction(() => {
            const prompt = [...document.querySelectorAll('#consoleTerminal [data-session-phase="ready"]')].at(-1);
            return prompt && prompt.dataset.runtimeBusy !== "true" && !document.body.classList.contains("console-cover-visible");
        }, null, { timeout: 60000 });
        await page.getByText("To cite package QCA in publications, please use:", { exact: false }).waitFor();
        await runConsoleCommand(page, "data(LF)");
        await runConsoleCommand(page, 'ttLF <- truthTable(LF, outcome = "SURV", incl.cut = 0.8, show.cases = TRUE, sort.by = "incl")');
        const opened = app.waitForEvent("window");
        await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById("QcaIncoherent").click());
        dialog = await opened;
        dialog.on("console", message => {
            if (message.type() === "error") errors.push(message.text());
        });
        dialog.setDefaultTimeout(30000);
        dialog.on("pageerror", error => errors.push(error.message));
        let rows = dialog.locator('[data-control-name="c_datasets"] .container-item');
        const truthTable = rows.filter({ hasText: /^ttLF$/ });
        await truthTable.waitFor();
        assert.deepEqual(await rows.allTextContents(), ["ttLF"]);
        await truthTable.locator(".container-text").click();
        await dialog.locator('[data-control-name="expressions_input"] textarea').fill("DEV*URB");
        await dialog.locator('[data-control-name="assign"] [role="checkbox"]').click();
        await dialog.locator('[data-control-name="object_name"] textarea').fill("incoherentLF");
        await dialog.locator('[data-control-name="object_name"] textarea').press("Tab");
        const command = 'incoherentLF <- findRows(obj = ttLF, expression = "DEV*URB", type = 1)';
        await page.waitForFunction(expected => document.getElementById("command")?.dataset.consoleSyntaxValue.trim() === expected, command);
        console.log("ttLF detected and generated command verified.");
        await dialog.screenshot({ path: path.join(os.tmpdir(), "incoherent-native-ttLF-verified.png") });
        await dialog.locator('[data-control-name="b_run"]').click();
        // The assigned result must come from the dialog's Run action.
        await runConsoleCommand(page, 'stopifnot(exists("incoherentLF"), identical(incoherentLF, findRows(obj = ttLF, expression = "DEV*URB", type = 1))); cat("INCOHERENT_RESULT_VERIFIED", "\\n")');
        await page.getByText("INCOHERENT_RESULT_VERIFIED", { exact: true }).waitFor();
        console.log("Dialog Run result equals QCA::findRows.");

        // Reset must query the current R workspace, including additions/removals.
        const reopened = app.waitForEvent("window");
        await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById("QcaIncoherent").click());
        dialog = await reopened;
        dialog.setDefaultTimeout(30000);
        dialog.on("pageerror", error => errors.push(error.message));
        dialog.on("console", message => {
            if (message.type() === "error") errors.push(message.text());
        });
        rows = dialog.locator('[data-control-name="c_datasets"] .container-item');
        await rows.filter({ hasText: /^ttLF$/ }).waitFor();
        await runConsoleCommand(page, "ttNew <- ttLF; rm(ttLF)");
        await dialog.locator('[data-control-name="b_reset"]').click();
        await rows.filter({ hasText: /^ttNew$/ }).waitFor();
        assert.deepEqual(await rows.allTextContents(), ["ttNew"]);
        await dialog.locator('[data-control-name="expressions_input"] textarea').fill("DEV*URB");
        await dialog.locator('[data-control-name="expressions_input"] textarea').press("Tab");
        await page.waitForFunction(() => document.getElementById("command")?.dataset.consoleSyntaxValue.trim() === 'findRows(obj = ttNew, expression = "DEV*URB", type = 1)');
        assert.deepEqual(errors, []);
        await dialog.screenshot({ path: path.join(os.tmpdir(), "incoherent-native-verified.png") });
        console.log("PASS native: ttLF detected, selected and run; assigned result equals QCA::findRows; Reset discovers current truth tables.");
    } catch (error) {
        console.error("Rendered errors:", errors);
        if (page && !page.isClosed()) console.error("Syntax:", await page.locator("#command").getAttribute("data-console-syntax-value"));
        if (dialog && !dialog.isClosed()) await dialog.screenshot({ path: path.join(os.tmpdir(), "incoherent-native-failure.png") });
        throw error;
    } finally {
        await app.close();
    }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
