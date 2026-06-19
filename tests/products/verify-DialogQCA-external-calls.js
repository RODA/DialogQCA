"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const { createQcaExternalCallHost, createQcaExternalCallHostForSession } = require("../../qca/qcaExternalCallHost");
const calls = [];
const host = createQcaExternalCallHost({
    listTruthTables: async function () {
        calls.push({ name: "listTruthTables" });
        return [{
                name: "tt1",
                options: {
                    conditions: "A, B"
                },
                id: ["12", "1", "2", "0"],
                out: ["1", "0", "?", "0"],
                cases: ["a", "b", "", "d"]
            }];
    },
    getCalibrateThresholds: async function (request) {
        calls.push({ name: "getCalibrateThresholds", request });
        return { thresholds: [0.25, 0.5, 0.75] };
    },
    getCalibratePreview: async function (request) {
        calls.push({ name: "getCalibratePreview", request });
        return { values: [0, 1] };
    },
    getXYPlotPreview: async function (request) {
        calls.push({ name: "getXYPlotPreview", request });
        return {
            x: [1],
            y: [0],
            labels: ["case1"],
            sufficiency: [["0.9", "0.8", "0.7"]]
        };
    }
});
const verify = async function () {
    assert.deepStrictEqual(await host.call("qca.listTruthTables"), {
        status: "ready",
        name: "qca.listTruthTables",
        value: [{
                name: "tt1",
                options: {
                    conditions: "A, B"
                },
                id: ["12", "1", "2", "0"],
                out: ["1", "0", "?", "0"],
                cases: ["a", "b", "", "d"]
            }],
        message: "DialogQCA external call resolved."
    });
    assert.deepStrictEqual((await host.call("qca.getCalibrateThresholds", {
        name: "data",
        variableName: "x",
        count: 3
    })).value, {
        thresholds: [0.25, 0.5, 0.75]
    });
    assert.deepStrictEqual((await host.call("qca.getCalibratePreview", {
        dataset: "data",
        variable: "x",
        thresholds: ["0.25", "0.5", "0.75"],
        thresholdNames: ["e", "c", "i"],
        logistic: true
    })).value, {
        values: [0, 1]
    });
    assert.strictEqual((await host.call("qca.validateCalibrateDialog", {
        selectedDataset: "data",
        selectedVariable: "x",
        type: "crisp",
        thresholdCount: 1,
        thresholdValues: ["0.5"]
    })).value, [
        "inside(data,",
        "  x <- calibrate(x,",
        "     type = \"crisp\",",
        "     thresholds = 0.5",
        "  )",
        ")"
    ].join("\n"));
    const calibrateState = (await host.call("qca.syncCalibrateDialog", {
        datasetContainer: "c_datasets",
        variableContainer: "c_variables",
        typeCrisp: "r_type_crisp",
        typeFuzzy: "r_type_fuzzy",
        shapeBell: "r_shape_bell",
        shapeS: "r_shape_s",
        directionInc: "r_dir_inc",
        directionDec: "r_dir_dec",
        thresholdCount: "cnt_nth",
        thresholdInputs: ["i_th1", "i_th2", "i_th3"],
        thresholdLabels: ["l_th1", "l_th2", "l_th3"],
        findThresholdsCheckbox: "checkbox_findth",
        logisticCheckbox: "checkbox_logistic",
        ecdfCheckbox: "checkbox_ecdf",
        jitterCheckbox: "checkbox_jitter",
        newConditionCheckbox: "checkbox_new_condition",
        newConditionInput: "i_newvar",
        idmInput: "i_idm",
        aboveInput: "i_above",
        belowInput: "i_below",
        plot: "plot_calibrate",
        event: "variable",
        __controlSnapshot: {
            c_datasets: { selected: ["data"] },
            c_variables: { selected: ["x"] },
            r_type_fuzzy: { checked: true },
            r_dir_inc: { checked: true },
            checkbox_logistic: { checked: true },
            cnt_nth: { value: "3" },
            i_idm: { value: "0.8" },
            i_above: { value: "1" },
            i_below: { value: "1" }
        }
    })).value;
    assert.strictEqual(calibrateState.state.selectedDataset, "data");
    assert.strictEqual(calibrateState.state.selectedVariable, "x");
    assert.deepStrictEqual(calibrateState.thresholdValues, ["0.25", "0.5", "0.75"]);
    assert.deepStrictEqual(calibrateState.previewPayload, { values: [0, 1] });
    assert.deepStrictEqual((await host.call("qca.getXYPlotPreview", {
        dataset: "data",
        xVariable: "x",
        yVariable: "y"
    })).value, {
        x: [1],
        y: [0],
        labels: ["case1"],
        sufficiency: [["0.9", "0.8", "0.7"]]
    });
    assert.deepStrictEqual((await host.call("qca.syncXYPlotDialog", {
        selectedDataset: "data",
        selectedX: "x",
        selectedY: "y",
        showParametersOfFit: true
    })).value, {
        selectedDataset: "data",
        selectedX: "x",
        selectedY: "y",
        xAxisLabel: "X",
        yAxisLabel: "Y",
        points: [
            { x: 1, y: 0, label: "case1" }
        ],
        fitLabels: ["Inclusion: 0.9", "Coverage: 0.8", "PRI: 0.7"],
        showGuides: true,
        showCases: false,
        fillPoints: true,
        jitterPoints: false,
        caseLabelRotation: 0
    });
    assert.strictEqual((await host.call("qca.syncXYPlotDialog", {
        guidesCheckbox: "guides",
        __controlSnapshot: {
            guides: { checked: false }
        }
    })).value.showGuides, false);
    assert.strictEqual((await host.call("qca.syncXYPlotDialog", {
        casesCheckbox: "cases",
        fillCheckbox: "fill",
        __controlSnapshot: {
            cases: { checked: true },
            fill: { checked: false }
        }
    })).value.showCases, true);
    assert.strictEqual((await host.call("qca.syncXYPlotDialog", {
        fillCheckbox: "fill",
        __controlSnapshot: {
            fill: { checked: false }
        }
    })).value.fillPoints, false);
    assert.strictEqual((await host.call("qca.syncXYPlotDialog", {
        jitterCheckbox: "jitter",
        __controlSnapshot: {
            jitter: { checked: true }
        }
    })).value.jitterPoints, true);
    assert.strictEqual((await host.call("qca.syncXYPlotDialog", {
        rotateInput: "rotate",
        __controlSnapshot: {
            rotate: { value: "2" }
        }
    })).value.caseLabelRotation, 90);
    assert.deepStrictEqual((await host.call("qca.initializeVennDialog", {
        showCustom: true,
        customText: "A*B"
    })).value, {
        truthTableNames: ["tt1"],
        selectedTruthTable: "tt1",
        renderPayload: {
            conditions: ["A", "B"],
            ids: ["12", "1", "2", "0"],
            out: ["1", "0", "?", "0"],
            cases: ["a", "b", "", "d"],
            showCustom: true,
            customText: "A*B"
        }
    });
    assert.deepStrictEqual((await host.call("qca.renderVenn", {
        truthTableName: "tt1"
    })).value, {
        conditions: ["A", "B"],
        ids: ["12", "1", "2", "0"],
        out: ["1", "0", "?", "0"],
        cases: ["a", "b", "", "d"],
        showCustom: false,
        customText: ""
    });
    assert.strictEqual((await host.call("qca.missing")).status, "unsupported");
    assert.deepStrictEqual(calls.map((call) => {
        return call.name;
    }), [
        "listTruthTables",
        "getCalibrateThresholds",
        "getCalibratePreview",
        "getCalibrateThresholds",
        "getCalibratePreview",
        "getXYPlotPreview",
        "getXYPlotPreview",
        "listTruthTables",
        "listTruthTables"
    ]);
    assert.deepStrictEqual(calls[1].request, {
        dataset: "data",
        variable: "x",
        thresholdCount: 3
    });
    const sessionCalls = [];
    const sessionHost = createQcaExternalCallHostForSession({
        executeRuntimeMethod: async function (request) {
            sessionCalls.push(request);
            if (request.method === "workspace.dataset_calibrate_thresholds") {
                return {
                    status: "ready",
                    providerId: "r",
                    method: request.method,
                    value: JSON.stringify({ thresholds: [0.2, 0.5, 0.8] }),
                    message: "ok",
                    executedAt: "test"
                };
            }
            if (request.method === "workspace.dataset_calibrate_preview") {
                return {
                    status: "ready",
                    providerId: "r",
                    method: request.method,
                    value: JSON.stringify({ values: [0, 0.5, 1] }),
                    message: "ok",
                    executedAt: "test"
                };
            }
            if (request.method === "workspace.dataset_xyplot_preview") {
                return {
                    status: "ready",
                    providerId: "r",
                    method: request.method,
                    value: JSON.stringify({ x: [1], y: [0], labels: ["case1"] }),
                    message: "ok",
                    executedAt: "test"
                };
            }
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
    assert.deepStrictEqual((await sessionHost.call("qca.listTruthTables")).value, [
        { name: "tt-session" }
    ]);
    assert.strictEqual(sessionCalls[0].method, "workspace.truth_tables");
    assert.strictEqual(sessionCalls[0].source, "contract-test");
    assert.deepStrictEqual((await sessionHost.call("qca.getCalibrateThresholds", {
        dataset: "survey",
        variable: "A",
        thresholdCount: 3
    })).value, {
        thresholds: [0.2, 0.5, 0.8]
    });
    assert.deepStrictEqual((await sessionHost.call("qca.getCalibratePreview", {
        dataset: "survey",
        variable: "A",
        thresholds: [0.2, 0.5, 0.8],
        thresholdNames: ["e", "c", "i"],
        variant: "fuzzy",
        logistic: true,
        ecdf: false,
        idm: 0.95,
        below: 1,
        above: 1
    })).value, {
        values: [0, 0.5, 1]
    });
    assert.deepStrictEqual((await sessionHost.call("qca.getXYPlotPreview", {
        dataset: "survey",
        xVariable: "A",
        yVariable: "Y"
    })).value, {
        x: [1],
        y: [0],
        labels: ["case1"]
    });
    assert.deepStrictEqual(sessionCalls[1].params, {
        name: "survey",
        variableName: "A",
        count: 3
    });
    assert.deepStrictEqual(sessionCalls[2].params, {
        name: "survey",
        variableName: "A",
        thresholds: [0.2, 0.5, 0.8],
        thresholdNames: ["e", "c", "i"],
        variant: "fuzzy",
        logistic: true,
        ecdf: false,
        idm: 0.95,
        below: 1,
        above: 1,
        increasing: true,
        bell: false
    });
    assert.deepStrictEqual(sessionCalls[3].params, {
        name: "survey",
        xVariableName: "A",
        yVariableName: "Y"
    });
    const failedSessionHost = createQcaExternalCallHostForSession({
        executeRuntimeMethod: async function (request) {
            return {
                status: "failed",
                providerId: "r",
                method: request.method,
                value: null,
                message: "runtime preview failed",
                executedAt: "test"
            };
        }
    }, "contract-test");
    const failedPreview = await failedSessionHost.call("qca.getXYPlotPreview", {
        dataset: "survey",
        xVariable: "A",
        yVariable: "Y"
    });
    assert.strictEqual(failedPreview.status, "failed");
    assert.strictEqual(failedPreview.message, "runtime preview failed");
};
verify()
    .then(() => {
    console.log("DialogQCA external-call host verified.");
})
    .catch((error) => {
    console.error(error);
    process.exit(1);
});
