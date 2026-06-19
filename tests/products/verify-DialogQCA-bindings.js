"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const { createQcaRuntimeBindings, createQcaRuntimeBindingsForSession } = require("../../qca/qcaBindings");
const calls = [];
const bindings = createQcaRuntimeBindings({
    execute: async function (method, params) {
        calls.push({ method, params });
        if (method === "workspace.truth_tables") {
            return JSON.stringify([{ name: "tt1", options: { outcome: "Y" } }]);
        }
        if (method === "workspace.dataset_calibrate_thresholds") {
            return JSON.stringify({ isNumeric: true, thresholds: [0.25, 0.5, 0.75] });
        }
        if (method === "workspace.dataset_calibrate_preview") {
            return JSON.stringify({ values: [0, 0.5, 1], rowNames: ["a", "b", "c"] });
        }
        if (method === "workspace.dataset_xyplot_preview") {
            return JSON.stringify({ labels: ["a"], x: [1], y: [0] });
        }
        return null;
    }
});
const verify = async function () {
    assert.deepStrictEqual(await bindings.listTruthTables(), [
        { name: "tt1", options: { outcome: "Y" } }
    ]);
    assert.deepStrictEqual(await bindings.getCalibrateThresholds({
        dataset: "data",
        variable: "x",
        thresholdCount: 3
    }), {
        isNumeric: true,
        thresholds: [0.25, 0.5, 0.75]
    });
    assert.deepStrictEqual(await bindings.getCalibratePreview({
        dataset: "data",
        variable: "x",
        thresholds: [0.25, 0.5, 0.75],
        thresholdNames: ["e", "c", "i"],
        variant: "fuzzy",
        logistic: false,
        ecdf: false,
        increasing: true,
        bell: false
    }), {
        values: [0, 0.5, 1],
        rowNames: ["a", "b", "c"]
    });
    assert.deepStrictEqual(await bindings.getXYPlotPreview({
        dataset: "data",
        xVariable: "x",
        yVariable: "y"
    }), {
        labels: ["a"],
        x: [1],
        y: [0]
    });
    assert.deepStrictEqual(calls.map((call) => {
        return call.method;
    }), [
        "workspace.truth_tables",
        "workspace.dataset_calibrate_thresholds",
        "workspace.dataset_calibrate_preview",
        "workspace.dataset_xyplot_preview"
    ]);
    assert.strictEqual(calls[1].params.count, 3);
    const sessionCalls = [];
    const sessionBindings = createQcaRuntimeBindingsForSession({
        executeRuntimeMethod: async function (request) {
            sessionCalls.push({
                method: request.method,
                params: request.params,
                source: request.source
            });
            return {
                status: "ready",
                providerId: "r",
                method: request.method,
                value: JSON.stringify([{ name: "tt-session" }]),
                message: "ok",
                executedAt: "test"
            };
        }
    }, "contract-test");
    assert.deepStrictEqual(await sessionBindings.listTruthTables(), [
        { name: "tt-session" }
    ]);
    assert.deepStrictEqual(sessionCalls, [
        {
            method: "workspace.truth_tables",
            params: {},
            source: "contract-test"
        }
    ]);
};
verify()
    .then(() => {
    console.log("DialogQCA runtime binding adapter verified.");
})
    .catch((error) => {
    console.error(error);
    process.exit(1);
});
