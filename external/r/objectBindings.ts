import type {
    ProfileCustomJSApi,
    ProfileCustomJSContext
} from "dialogforge/shared/dialog-runtime/renderer/modules/profileCustomJSApi";
import {
    QCA_EXTERNAL_CALLS
} from "./externalCalls";
import type {
    DialogQcaRuntimeApi
} from "./runtimeApi";
import {
    asPayloadRecord,
    asString,
    firstSelected
} from "./runtimeApi";


const readVariableControls = function(value: unknown): string[] {
    if (typeof value === "string") {
        return [asString(value)].filter(Boolean);
    }

    if (Array.isArray(value)) {
        return value.map(asString).filter(Boolean);
    }

    const source = asPayloadRecord(value);

    return Object.values(source).flatMap((entry) => {
        if (Array.isArray(entry)) {
            return entry.map(asString).filter(Boolean);
        }

        return [asString(entry)].filter(Boolean);
    });
};


export const registerObjectBindings = function(options: {
    api: ProfileCustomJSApi;
    runtimeApi: DialogQcaRuntimeApi;
    context: ProfileCustomJSContext;
    getDatasetVariables: (
        dataset: string
    ) => Promise<Record<string, unknown>[] | null>;
}): void {
    // How a selected object is written into a generated command. QCA has no
    // filter feature yet, so this resolves to the plain object name; once one
    // exists, answering "filter:getState" is all it takes for every dialog to
    // pick it up through getReference(), with no dialog script changes.
    if (options.api.registerObjectReferenceResolver) {
        options.api.registerObjectReferenceResolver(async (objectName) => {
            const name = asString(objectName);

            if (!name) {
                return "";
            }

            try {
                const state = asPayloadRecord(
                    await options.context.coms.invoke(
                        "base-app:callDialogExternal",
                        QCA_EXTERNAL_CALLS.GET_FILTER_STATE,
                        { dataset: name }
                    )
                );
                const command = asString(state.command);

                return command || name;
            } catch {
                // Nothing answers that call yet, so the object keeps its name.
                return name;
            }
        });
    }

    const baseBindObjects = options.api.bindObjects;

    if (typeof baseBindObjects === "function") {
        return;
    }

    const activeBindings = new Set<string>();

    options.api.bindObjects = function(parameters) {
        const payload = asPayloadRecord(parameters);
        const datasetControl = asString(payload.datasets);
        const variableControls = readVariableControls(payload.variables);
        const autoRefresh = payload.autoRefresh !== false;
        const bindingKey = [
            datasetControl,
            autoRefresh ? "auto" : "manual",
            ...variableControls
        ].join("\u0000");

        const refresh = async function(): Promise<void> {
            if (!datasetControl) {
                return;
            }

            if (
                typeof options.runtimeApi.setValue === "function"
            ) {
                const datasets = options.runtimeApi.listObjects?.("datasets");

                if (Array.isArray(datasets)) {
                    options.runtimeApi.setValue(datasetControl, datasets);
                }
            }

            if (typeof options.runtimeApi.getSelected !== "function") {
                return;
            }

            const selectedDataset = firstSelected(
                options.runtimeApi.getSelected(datasetControl)
            );

            if (!selectedDataset) {
                if (
                    variableControls.length > 0
                    && typeof options.runtimeApi.clearContent === "function"
                ) {
                    options.runtimeApi.clearContent(...variableControls);
                }

                variableControls.forEach((control) => {
                    options.runtimeApi.triggerChange?.(control);
                });
                return;
            }

            if (variableControls.length === 0) {
                return;
            }

            const variables = await options.getDatasetVariables(selectedDataset);

            variableControls.forEach((control) => {
                options.runtimeApi.setValue?.(control, variables || []);
                options.runtimeApi.triggerChange?.(control);
            });
        };

        if (autoRefresh && !activeBindings.has(bindingKey)) {
            activeBindings.add(bindingKey);
            options.context.objects?.events?.on?.("workspaceDataUpdated", () => {
                void refresh();
            });
            if (
                datasetControl
                && variableControls.length > 0
                && typeof options.runtimeApi.onChange === "function"
            ) {
                options.runtimeApi.onChange(datasetControl, () => {
                    void refresh();
                });
            }
        }

        if (autoRefresh) {
            void refresh();
        }

        return { refresh };
    };
};
