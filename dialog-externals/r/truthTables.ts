import type {
    ProfileCustomJSContext
} from "dialogforge/shared/dialog-runtime/renderer/modules/profileCustomJSApi";
import type {
    DialogQcaRuntimeApi
} from "./runtimeApi";
import {
    asPayloadRecord,
    asString
} from "./runtimeApi";


interface TruthTableAccessOptions {
    api: DialogQcaRuntimeApi;
    context: ProfileCustomJSContext;
    invoke: (
        channel: string,
        payload?: Record<string, unknown>
    ) => Promise<unknown>;
}


const normalizeTruthTableNames = function(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    const names: string[] = [];
    const seen = new Set<string>();

    value.forEach((item) => {
        const source = asPayloadRecord(item);
        const name = Object.keys(source).length
            ? asString(source.name ?? source.value ?? source.text)
            : asString(item);

        if (!name || seen.has(name)) {
            return;
        }

        seen.add(name);
        names.push(name);
    });

    return names;
};


export const createTruthTableAccess = function(options: TruthTableAccessOptions) {
    let cache: unknown[] | null = null;

    const load = async function(): Promise<unknown[]> {
        if (cache) {
            return cache;
        }

        try {
            const result = await options.invoke("qca.listTruthTables");

            cache = Array.isArray(result) ? result : [];
        } catch (error) {
            console.error("Unable to list QCA truth tables", error);
            cache = [];
        }

        return cache;
    };

    const listAvailableNames = async function(): Promise<string[]> {
        cache = null;

        const backendNames = normalizeTruthTableNames(await load());
        const workspaceNames = normalizeTruthTableNames(
            options.api.listObjects?.("truthtables")
        );
        const names: string[] = [];
        const seen = new Set<string>();

        [...backendNames, ...workspaceNames].forEach((name) => {
            if (!name || seen.has(name)) {
                return;
            }

            seen.add(name);
            names.push(name);
        });

        return names;
    };

    const registerObjectSource = function(): void {
        options.api.registerObjectSource?.("truthtables", {
            listNames: () => {
                const variables = Array.isArray(
                    options.context.objects?.workspaceVariables
                )
                    ? options.context.objects.workspaceVariables
                    : [];
                const names = new Set<string>();

                variables.forEach((item: unknown) => {
                    const source = asPayloadRecord(item);
                    const typeTokens = asString(
                        source.display_type || source.type_info
                    ).toLowerCase().split("/").map((value) => {
                        return value.trim();
                    }).filter(Boolean);
                    const name = asString(
                        source.access_key || source.display_name
                    );

                    if (
                        name
                        && (
                            typeTokens.includes("qca_tt")
                            || typeTokens.includes("tt")
                        )
                    ) {
                        names.add(name);
                    }
                });

                return Array.from(names);
            },
            emitSelectionChange: false
        });
    };

    return {
        listAvailableNames,
        load,
        registerObjectSource
    };
};
