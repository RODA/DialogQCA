"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const { VENN_GEOMETRY } = require("../../qca/vennGeometry");
const { renderVennDiagram } = require("../../qca/vennRenderer");
const { buildQcaVennRenderPayload, createQcaVennDialogState, listQcaTruthTableNames, normalizeQcaConditionList } = require("../../qca/qcaVennDialog");
const geometry = VENN_GEOMETRY;
for (let size = 1; size <= 7; size += 1) {
    const shape = geometry[`s${size}`];
    const labels = geometry[`l${size}`];
    const pathSegments = shape[0];
    const zoneMappings = shape[1];
    assert.ok(Array.isArray(shape), `Missing shape geometry for ${size} conditions.`);
    assert.ok(Array.isArray(pathSegments), `Shape ${size} is missing path segments.`);
    assert.ok(Array.isArray(zoneMappings), `Shape ${size} is missing zone mappings.`);
    assert.ok(pathSegments.length > 0, `Shape ${size} has no path segments.`);
    assert.strictEqual(zoneMappings.length, 2 ** size, `Shape ${size} must map every truth-table zone.`);
    assert.ok(labels, `Missing label geometry for ${size} conditions.`);
    assert.strictEqual(labels.x.length, size, `Label x coordinates must match ${size} conditions.`);
    assert.strictEqual(labels.y.length, size, `Label y coordinates must match ${size} conditions.`);
}
assert.strictEqual(typeof renderVennDiagram, "function");
const truthTables = [
    {
        name: "tt_old",
        options: {
            conditions: ["A", "B"]
        },
        id: ["12"],
        out: ["1"],
        cases: ["a"]
    },
    {
        name: "tt_new",
        options: {
            conditions: "C, D, E"
        },
        id: ["123", "12", "3", "0"],
        out: ["1", "0", "?", "0"],
        cases: ["a,b", "c", "", "d"]
    },
    {
        value: "tt_old"
    }
];
assert.deepStrictEqual(normalizeQcaConditionList("A, B, C"), ["A", "B", "C"]);
assert.deepStrictEqual(listQcaTruthTableNames(truthTables), ["tt_old", "tt_new"]);
assert.deepStrictEqual(createQcaVennDialogState({
    truthTables,
    previousSelection: "missing",
    showCustom: true,
    customText: "~C + D"
}), {
    truthTableNames: ["tt_old", "tt_new"],
    selectedTruthTable: "tt_new",
    renderPayload: {
        conditions: ["C", "D", "E"],
        ids: ["123", "12", "3", "0"],
        out: ["1", "0", "?", "0"],
        cases: ["a,b", "c", "", "d"],
        showCustom: true,
        customText: "~C + D"
    }
});
assert.deepStrictEqual(buildQcaVennRenderPayload({
    truthTables,
    truthTableName: "tt_old"
}), {
    conditions: ["A", "B"],
    ids: ["12"],
    out: ["1"],
    cases: ["a"],
    showCustom: false,
    customText: ""
});
console.log("DialogQCA Venn geometry and renderer exports verified.");
