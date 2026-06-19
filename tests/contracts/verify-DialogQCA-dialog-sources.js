"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const productRoot = path.resolve(__dirname, "../..");
const readJson = function (filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
};
const registry = readJson(path.join(productRoot, "dialogs/dialogs.json"));
assert.ok(Array.isArray(registry));
assert.strictEqual(registry.length, 7);
registry.forEach((dialog) => {
    assert.strictEqual(dialog.status, "source-imported");
    assert.ok(dialog.sourceFile);
    const sourceDialog = readJson(path.join(productRoot, "dialogs", dialog.sourceFile));
    assert.ok(sourceDialog.properties);
    assert.ok(sourceDialog.customJS || sourceDialog.syntax);
    assert.ok(Array.isArray(sourceDialog.elements));
    assert.ok(sourceDialog.elements.length > 0);
});
console.log("DialogQCA dialog source registry verified.");
