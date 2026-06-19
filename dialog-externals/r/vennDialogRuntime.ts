import {
    renderVennDiagram
} from "../../qca/vennRenderer";
import type {
    DialogQcaRuntimeApi
} from "./runtimeApi";
import {
    asPayloadRecord,
    asString,
    firstSelected
} from "./runtimeApi";


const normalizeConditions = function(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.map(asString).filter(Boolean);
    }

    const text = asString(value);

    return text
        ? text.split(",").map((item) => item.trim()).filter(Boolean)
        : [];
};


export const createVennDialogRuntime = function(options: {
    api: DialogQcaRuntimeApi;
    loadTruthTables: () => Promise<unknown[]>;
    listTruthTableNames: () => Promise<string[]>;
}) {
    const blurBindings = new WeakSet<HTMLElement>();

    const attachInputBlur = function(elementName: unknown): void {
        const host = options.api.getElementNode?.(elementName);

        if (!(host instanceof HTMLElement) || blurBindings.has(host)) {
            return;
        }

        blurBindings.add(host);
        host.addEventListener("keydown", (event) => {
            if (event.key !== "Enter") {
                return;
            }

            event.preventDefault();
            host.blur();
        });
    };

    const render = async function(payload: unknown) {
        const source = asPayloadRecord(payload);
        const target = asString(source.target);
        const host = options.api.getElementNode?.(target);

        if (!(host instanceof HTMLElement)) {
            throw new Error("qca.renderVenn expects a target Plot element name");
        }

        const truthTableName = asString(source.truthTableName);
        let nextPayload = { ...source };

        delete nextPayload.target;

        if (
            truthTableName
            && !Array.isArray(source.ids)
            && !Array.isArray(source.out)
            && !Array.isArray(source.cases)
        ) {
            const tables = await options.loadTruthTables();
            const entry = tables.map(asPayloadRecord).find((item) => {
                return asString(item.name) === truthTableName;
            }) || {};

            nextPayload = {
                ...nextPayload,
                conditions: normalizeConditions(
                    source.conditions
                    ?? asPayloadRecord(entry.options).conditions
                ),
                ids: Array.isArray(entry.id) ? entry.id : [],
                out: Array.isArray(entry.out) ? entry.out : [],
                cases: Array.isArray(entry.cases) ? entry.cases : []
            };
        }

        renderVennDiagram(host, nextPayload);

        return null;
    };

    const sync = async function(payload: unknown) {
        const source = asPayloadRecord(payload);
        const truthTableSelect = asString(source.truthTableSelect);
        const customCheckbox = asString(source.customCheckbox);
        const customInput = asString(source.customInput);
        const truthTableName = truthTableSelect
            ? firstSelected(options.api.getSelected?.(truthTableSelect))
            : "";

        if (!truthTableName) {
            return render({
                target: source.target,
                conditions: [],
                ids: [],
                out: [],
                cases: [],
                showCustom: false,
                customText: ""
            });
        }

        return render({
            target: source.target,
            truthTableName,
            showCustom: customCheckbox
                ? options.api.isChecked?.(customCheckbox) === true
                : false,
            customText: customInput
                ? asString(options.api.getValue?.(customInput))
                : ""
        });
    };

    const refreshTruthTableSelect = async function(payload: unknown): Promise<string[]> {
        const source = asPayloadRecord(payload);
        const truthTableSelect = asString(source.truthTableSelect);

        if (!truthTableSelect) {
            return [];
        }

        const names = await options.listTruthTableNames();
        const previousValue = firstSelected(
            options.api.getSelected?.(truthTableSelect)
        );
        const nextValue = names.includes(previousValue)
            ? previousValue
            : names[names.length - 1] || "";

        options.api.setValue?.(truthTableSelect, names);
        options.api.setSelected?.(truthTableSelect, nextValue);

        return names;
    };

    return {
        attachInputBlur,
        refreshTruthTableSelect,
        render,
        sync
    };
};
