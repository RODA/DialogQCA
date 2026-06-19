import type {
    ProfileCustomJSContext
} from "dialogforge/shared/dialog-runtime/renderer/modules/profileCustomJSApi";
import {
    asPayloadRecord,
    asString
} from "./runtimeApi";


const DATASET_ITEM_TYPES = [
    "numeric",
    "factor",
    "calibrated",
    "binary",
    "character",
    "categorical",
    "date"
] as const;


type DatasetItemType = typeof DATASET_ITEM_TYPES[number];


const firstTypeToken = function(value: unknown): string {
    return asString(value)
        .split(/[\/,]/)
        .map((entry) => entry.trim().toLowerCase())
        .find(Boolean) || "";
};


const toDialogVariableEntry = function(value: unknown): Record<string, unknown> | null {
    const source = asPayloadRecord(value);
    const name = asString(source.name || source.text);

    if (!name) {
        return null;
    }

    const typeToken = firstTypeToken(source.type);
    const measure = asString(source.measure).toLowerCase();
    const categories = Array.isArray(source.categories) ? source.categories : [];
    const isMeasuredNumeric = measure === "interval"
        || measure === "ratio"
        || measure === "scale";
    const isIntrinsicNumeric = typeToken === "numeric"
        || typeToken === "double"
        || typeToken === "integer"
        || isMeasuredNumeric;
    const isOrdinalNumeric = measure === "ordinal" && categories.length >= 7;
    const isNominalCategorical = measure === "nominal" && categories.length > 0;
    const isFactor = typeToken === "factor" || typeToken === "ordered";
    const isCategorical = isFactor
        || measure === "nominal"
        || measure === "ordinal";
    const isCalibrated = source.calibrated === true;

    return {
        ...source,
        name,
        numeric: (!isNominalCategorical && isIntrinsicNumeric)
            || isOrdinalNumeric
            || isCalibrated,
        factor: isFactor || isCategorical,
        calibrated: isCalibrated,
        binary: typeToken === "logical" || categories.length === 2,
        character: typeToken === "character",
        categorical: isCategorical,
        date: typeToken === "date"
            || typeToken === "posixct"
            || typeToken === "posixlt"
    };
};


const hasDatasetTypeFlags = function(value: unknown): boolean {
    const source = asPayloadRecord(value);

    return DATASET_ITEM_TYPES.some((typeName) => {
        const values = source[typeName];

        return Array.isArray(values) && values.some((item) => {
            return typeof item === "boolean";
        });
    });
};


export const createQcaDataAccess = function(context: ProfileCustomJSContext) {
    const getCachedDataset = function(dataset: string): Record<string, unknown> {
        return asPayloadRecord(context.objects?.dataframes?.[dataset]);
    };

    const getVariableValues = async function(
        dataset: string,
        variable: string
    ): Promise<unknown> {
        if (!dataset || !variable) {
            return null;
        }

        try {
            return await context.coms.invoke("dialog:getVariableValues", {
                name: dataset,
                variableName: variable
            });
        } catch (error) {
            console.error("Unable to read QCA dialog variable values", error);
            return null;
        }
    };

    const getDatasetVariables = async function(
        dataset: string
    ): Promise<Record<string, unknown>[] | null> {
        if (!dataset) {
            return null;
        }

        const cached = getCachedDataset(dataset);

        if (Array.isArray(cached.colnames) && hasDatasetTypeFlags(cached)) {
            const names = cached.colnames.map(asString).filter(Boolean);

            return names.map((name, index) => {
                const entry: Record<string, unknown> = { name };

                DATASET_ITEM_TYPES.forEach((typeName: DatasetItemType) => {
                    const values = Array.isArray(cached[typeName])
                        ? cached[typeName] as unknown[]
                        : [];

                    if (typeof values[index] === "boolean") {
                        entry[typeName] = values[index] === true;
                    }
                });

                return entry;
            });
        }

        try {
            const result = await context.coms.invoke("datasetViewer:getVariables", {
                name: dataset
            });

            if (!Array.isArray(result)) {
                return null;
            }

            return result.map(toDialogVariableEntry).filter((entry) => {
                return entry !== null;
            }) as Record<string, unknown>[];
        } catch (error) {
            console.error("Unable to read QCA dialog dataset variables", error);
            return null;
        }
    };

    const listDatasetColumns = function(dataset: string): string[] {
        const cached = getCachedDataset(dataset);

        return Array.isArray(cached.colnames)
            ? cached.colnames.map(asString).filter(Boolean)
            : [];
    };

    return {
        getDatasetVariables,
        getVariableValues,
        listDatasetColumns
    };
};
