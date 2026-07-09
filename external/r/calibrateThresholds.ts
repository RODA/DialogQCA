import type {
    DialogQcaRuntimeApi
} from "./runtimeApi";
import {
    asPayloadRecord,
    asString
} from "./runtimeApi";


export type CalibrateThresholdKey = "crisp" | "fuzzyS" | "fuzzyB";


export interface CalibrateThresholdState {
    currentKey: CalibrateThresholdKey;
    store: Record<CalibrateThresholdKey, string[]>;
}


export interface CalibrateThresholdContext {
    stateKey: string;
    thresholdInputIds: string[];
    visibleThresholdCount: number;
    isCrisp: boolean;
    isBell: boolean;
    isIncreasing: boolean;
    activeKey: CalibrateThresholdKey;
}


const normalizeThresholdKey = function(
    isCrisp: boolean,
    isBell: boolean
): CalibrateThresholdKey {
    if (isCrisp) {
        return "crisp";
    }

    return isBell ? "fuzzyB" : "fuzzyS";
};


export const createCalibrateThresholdController = function(
    api: DialogQcaRuntimeApi
) {
    const states = new Map<string, CalibrateThresholdState>();

    const resetState = function(stateKey: string): CalibrateThresholdState {
        const state: CalibrateThresholdState = {
            currentKey: "fuzzyS",
            store: {
                crisp: ["", "", "", "", "", ""],
                fuzzyS: ["", "", "", "", "", ""],
                fuzzyB: ["", "", "", "", "", ""]
            }
        };

        states.set(stateKey, state);

        return state;
    };

    const getState = function(stateKey: string): CalibrateThresholdState {
        if (!states.has(stateKey)) {
            resetState(stateKey);
        }

        return states.get(stateKey)!;
    };

    const getContext = function(payload: unknown): CalibrateThresholdContext {
        const source = asPayloadRecord(payload);
        const thresholdInputIds = Array.isArray(source.thresholdInputIds)
            ? source.thresholdInputIds.map(asString).filter(Boolean)
            : [];
        const visibleThresholdCount = Math.max(
            0,
            Math.min(
                thresholdInputIds.length,
                Number(source.visibleThresholdCount) || 0
            )
        );
        const isCrisp = source.isCrisp === true;
        const isBell = source.isBell === true;

        return {
            stateKey: asString(source.stateKey) || "qca.calibrate.thresholds",
            thresholdInputIds,
            visibleThresholdCount,
            isCrisp,
            isBell,
            isIncreasing: source.isIncreasing === true,
            activeKey: normalizeThresholdKey(isCrisp, isBell)
        };
    };

    const readValues = function(thresholdInputIds: string[]): string[] {
        return thresholdInputIds.map((inputId) => {
            return asString(api.getValue?.(inputId));
        });
    };

    const getStoredValues = function(context: CalibrateThresholdContext): string[] {
        const stored = getState(context.stateKey).store[context.activeKey];

        if (stored.length > 0) {
            return stored
                .slice(0, context.thresholdInputIds.length)
                .map(asString);
        }

        return readValues(context.thresholdInputIds);
    };

    const applyVisibleValues = function(
        thresholdInputIds: string[],
        visibleThresholdCount: number,
        values: string[]
    ): void {
        thresholdInputIds.forEach((inputId, index) => {
            if (index >= visibleThresholdCount) {
                return;
            }

            api.setValue?.(inputId, values[index] ?? "");
        });
    };

    const getNames = function(
        isCrisp: boolean,
        isBell: boolean,
        isIncreasing: boolean
    ): string[] {
        if (isCrisp) {
            return ["th1", "th2", "th3", "th4", "th5", "th6"];
        }

        if (isBell) {
            return isIncreasing
                ? ["e1", "c1", "i1", "i2", "c2", "e2"]
                : ["i1", "c1", "e1", "e2", "c2", "i2"];
        }

        return isIncreasing ? ["e", "c", "i"] : ["i", "c", "e"];
    };

    const buildSpec = function(payload: unknown) {
        const context = getContext(payload);
        const names = getNames(
            context.isCrisp,
            context.isBell,
            context.isIncreasing
        );
        const values = getStoredValues(context);
        const result: Array<{
            index: number;
            name: string;
            value: string;
            numeric: number | null;
        }> = [];

        for (let index = 0; index < context.visibleThresholdCount; index += 1) {
            const value = asString(values[index]);

            if (!value) {
                continue;
            }

            const numeric = Number(value);

            result.push({
                index,
                name: names[index] || "",
                value,
                numeric: Number.isFinite(numeric) ? numeric : null
            });
        }

        return result;
    };

    const buildInsertion = function(payload: unknown): string[] {
        const source = asPayloadRecord(payload);
        const context = getContext(payload);
        const numericValue = Number(source.value);

        if (!Number.isFinite(numericValue) || context.visibleThresholdCount < 1) {
            return [];
        }

        const values = readValues(context.thresholdInputIds)
            .slice(0, context.visibleThresholdCount)
            .map(asString);
        const formattedValue = String(Math.round(numericValue * 1000) / 1000);
        const insertAt = values.findIndex((entry) => {
            return !entry;
        });

        if (insertAt === -1) {
            values[context.visibleThresholdCount - 1] = formattedValue;
        } else {
            values[insertAt] = formattedValue;
        }

        return values;
    };

    return {
        applyVisibleValues,
        buildInsertion,
        buildSpec,
        getContext,
        getNames,
        resetState,
        getState,
        getStoredValues,
        readValues
    };
};
