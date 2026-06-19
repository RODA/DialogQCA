"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const productRoot = path.resolve(__dirname, "../..");
const expectedLocales = [
    "de_DE",
    "el_GR",
    "en_US",
    "es_ES",
    "fr_FR",
    "pl_PL",
    "ro_RO"
];
const i18nDir = path.join(productRoot, "i18n");
const locales = fs.readdirSync(i18nDir).filter((fileName) => {
    return fileName.endsWith(".json");
}).map((fileName) => {
    return fileName.replace(/\.json$/, "");
}).sort();
assert.deepStrictEqual(locales, expectedLocales);
for (const locale of expectedLocales) {
    const strings = JSON.parse(fs.readFileSync(path.join(i18nDir, `${locale}.json`), "utf8"));
    assert.strictEqual(typeof strings, "object");
    assert.ok(Object.keys(strings).length > 0, `DialogQCA ${locale} should not be empty.`);
}
console.log("DialogQCA i18n locale files verified.");
