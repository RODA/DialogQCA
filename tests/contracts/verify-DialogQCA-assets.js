"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const productRoot = path.resolve(__dirname, "../..");
const requiredProductAssets = [
    "assets/icons/icon.svg",
    "assets/icons/icon.png",
    "assets/icons/icon.ico",
    "assets/icons/icon.icns"
];
const forbiddenProductAssets = [
    "assets/fonts/app-extra-codicon.ttf",
    "assets/fonts/positron-codicon.ttf",
    "assets/icons/Thumbs.db"
];
for (const assetPath of requiredProductAssets) {
    const filePath = path.join(productRoot, assetPath);
    assert.ok(fs.existsSync(filePath), `DialogQCA is missing ${assetPath}.`);
    assert.ok(fs.statSync(filePath).size > 0, `DialogQCA ${assetPath} is empty.`);
}
for (const assetPath of forbiddenProductAssets) {
    assert.strictEqual(fs.existsSync(path.join(productRoot, assetPath)), false, `DialogQCA must not carry ${assetPath}.`);
}
console.log("DialogQCA product assets verified.");
