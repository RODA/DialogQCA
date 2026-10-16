"use strict";

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { dialogForgeRoot: forge } = require('./dialogforge');
const product = path.resolve(__dirname, '..');
const { _electron } = require(path.join(forge, 'node_modules/playwright'));
const { productLaunchArgs, findMainWindowPage } = require(path.join(forge, 'tests/electron/product-launch'));
const { runConsoleCommand } = require(path.join(forge, 'tests/support/console-interactions'));
process.chdir(forge);
process.env.DIALOGFORGE_ELECTRON_PRODUCT_PATH = product;
(async () => {
    const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'fiss-toolbar-'));
    const app = await _electron.launch({
        executablePath: require(path.join(forge, 'node_modules/electron')),
        args: productLaunchArgs(path.join(forge, 'dist/scripts/electron-main.js')),
        cwd: forge,
        env: { ...process.env, DIALOGFORGE_TEST_USER_DATA_PATH: userData }
    });
    try {
        const page = await findMainWindowPage(app);
        page.setDefaultTimeout(30000);
        await page.waitForFunction(() => {
            const prompt = [...document.querySelectorAll('#consoleTerminal [data-session-phase="ready"]')].at(-1);
            return prompt && prompt.dataset.runtimeBusy !== 'true' && !document.body.classList.contains('console-cover-visible');
        }, null, { timeout: 60000 });
        await page.getByText("To cite package QCA in publications, please use:", { exact: false }).waitFor();
        for (const command of [
            'data(LF)',
            'ttLF <- truthTable(LF, SURV, incl.cut = 0.8, show.cases = TRUE)',
            'isLF <- minimize(ttLF, include = "?", details = TRUE, dir.exp = c(DEV, URB, LIT, IND, STB))'
        ]) {
            await runConsoleCommand(page, command);
        }
        const opened = app.waitForEvent('window');
        await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('QcaFiss').click());
        const dialog = await opened;
        dialog.setDefaultTimeout(30000);
        const svg = dialog.locator('.plot-dialog-viewport svg');
        await svg.waitFor();
        const toolbar = dialog.locator('.plot-dialog-window-toolbar');
        assert.equal(await toolbar.locator('.plot-dialog-window-title').count(), 0);
        const reset = toolbar.getByRole('button', { name: 'Reset', exact: true });
        assert.equal(await reset.getAttribute('title'), 'Restore default chart settings and 100% zoom');
        const title = dialog.locator('[data-control-name="title_input"] textarea');
        const expectedCommand = "plot(\n  fissChart(isLF),\n  legend = FALSE\n)";
        await page.waitForFunction(command => document.getElementById("command")?.dataset.consoleSyntaxValue === command, expectedCommand);
        const defaultTitle = await title.inputValue();
        assert(defaultTitle.startsWith('Configurations for '));
        const legend = dialog.locator('[data-control-name="legend_checkbox"] [role="checkbox"]');
        const labels = dialog.locator('[data-control-name="labels_checkbox"] [role="checkbox"]');
        assert.equal(await legend.getAttribute('aria-checked'), 'false');
        assert.equal(await labels.getAttribute('aria-checked'), 'false');
        const checkTitle = async (expected) => {
            await dialog.waitForFunction(text => {
                const field = document.querySelector('[data-control-name="title_input"] textarea');
                const chart = document.querySelector('.plot-dialog-viewport svg');
                return field?.value === text && chart?.textContent.includes(text);
            }, expected).catch(async (error) => {
                console.error({
                    expected,
                    actual: await title.inputValue(),
                    chart: await svg.textContent(),
                    command: await page.locator("#command").getAttribute("data-console-syntax-value")
                });
                throw error;
            });
        };
        await checkTitle('Configurations for SURV');
        await labels.click();
        await checkTitle('Configurations for Democracy survival');
        await page.waitForFunction(() => document.getElementById('command')?.dataset.consoleSyntaxValue.includes('main = "Configurations for Democracy survival"'));
        await labels.click();
        await checkTitle('Configurations for SURV');
        await page.waitForFunction(command => document.getElementById('command')?.dataset.consoleSyntaxValue === command, expectedCommand);
        // Explicitly re-enter the old automatic title: intent comes from editing,
        // even when the resulting text happens to equal the default.
        await title.fill('Configurations for ');
        await title.pressSequentially('SURV');
        await labels.click();
        await checkTitle('Configurations for SURV');
        await page.waitForFunction(() => {
            const command = document.getElementById('command')?.dataset.consoleSyntaxValue || '';
            return command.includes('labels =') && !command.includes('main =');
        });
        await title.fill('');
        await checkTitle('Configurations for Democracy survival');
        await labels.click();
        await checkTitle('Configurations for SURV');
        await title.fill('Edited chart title');
        await legend.click();
        await labels.click();
        await svg.filter({ hasText: 'Edited chart title' }).waitFor();
        assert.equal(await legend.getAttribute('aria-checked'), 'true');
        assert.equal(await labels.getAttribute('aria-checked'), 'true');
        await page.waitForFunction(() => {
            const command = document.getElementById("command")?.dataset.consoleSyntaxValue || "";
            return command.includes('main = "Edited chart title"') && command.includes("labels =") && !command.includes("legend =");
        });
        await labels.click();
        await checkTitle('Edited chart title');
        await page.waitForFunction(() => {
            const command = document.getElementById('command')?.dataset.consoleSyntaxValue || '';
            return command.includes('main = "Edited chart title"') && !command.includes('labels =');
        });
        await toolbar.getByRole('button', { name: 'Set the plot zoom', exact: true }).click();
        await dialog.getByRole('menuitemradio', { name: '200%', exact: true }).click();
        await reset.click();
        await svg.filter({ hasText: defaultTitle }).waitFor();
        assert.equal(await title.inputValue(), defaultTitle);
        assert.equal(await legend.getAttribute('aria-checked'), 'false');
        assert.equal(await labels.getAttribute('aria-checked'), 'false');
        await toolbar.getByRole('button', { name: 'Set the plot zoom', exact: true }).filter({ hasText: '100%' }).waitFor();
        assert.equal(await toolbar.locator('.plot-dialog-window-title').count(), 0);
        await page.waitForFunction(command => document.getElementById("command")?.dataset.consoleSyntaxValue === command, expectedCommand);
        await dialog.close();

        // Start a second chart from a truth table whose own default uses labels.
        for (const command of [
            'ttLabels <- truthTable(LF, SURV, incl.cut = 0.8, use.labels = TRUE)',
            'isLabels <- minimize(ttLabels, include = "?", details = TRUE, dir.exp = c(DEV, URB, LIT, IND, STB))'
        ]) {
            await runConsoleCommand(page, command);
        }
        const labelsOpened = app.waitForEvent('window');
        await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('QcaFiss').click());
        const labelsDialog = await labelsOpened;
        labelsDialog.setDefaultTimeout(30000);
        await labelsDialog.locator('.dm-select select').first().selectOption('isLabels');
        const inheritedLabels = labelsDialog.locator('[data-control-name="labels_checkbox"] [role="checkbox"]');
        const inheritedTitle = labelsDialog.locator('[data-control-name="title_input"] textarea');
        const checkInheritedTitle = async (expected) => {
            await labelsDialog.waitForFunction(text => {
                const field = document.querySelector('[data-control-name="title_input"] textarea');
                const chart = document.querySelector('.plot-dialog-viewport svg');
                return field?.value === text && chart?.textContent.includes(text);
            }, expected);
        };
        await checkInheritedTitle('Configurations for Democracy survival');
        await page.waitForFunction(() => document.getElementById('command')?.dataset.consoleSyntaxValue.includes('fissChart(isLabels)'));
        assert.equal(await inheritedTitle.inputValue(), 'Configurations for Democracy survival');
        assert.equal(await inheritedLabels.getAttribute('aria-checked'), 'true');
        await inheritedLabels.click();
        await checkInheritedTitle('Configurations for SURV');
        assert.equal(await inheritedTitle.inputValue(), 'Configurations for SURV');
        await inheritedLabels.click();
        await checkInheritedTitle('Configurations for Democracy survival');
        assert.equal(await inheritedTitle.inputValue(), 'Configurations for Democracy survival');
        assert.equal(await inheritedLabels.getAttribute('aria-checked'), 'true');
        await labelsDialog.close();
        console.log('PASS native Fiss: automatic outcome labels toggle, explicit titles survive toggles, clearing restores automatic title, Reset restores defaults');
    }
    finally {
        await app.close();
        fs.rmSync(userData, { recursive: true, force: true });
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
