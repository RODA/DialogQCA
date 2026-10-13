import { getPlotResetButton, getPlotToolbarHost } from "../../qca/svgPlotToolbar";
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
    const toolbarControls = new WeakMap<HTMLElement, HTMLElement>();

    const moveControlsToToolbar = function(host: HTMLElement, source: Record<string, unknown>): HTMLElement {
        let controls = toolbarControls.get(host);
        if (!controls) {
            controls = document.createElement("div");
            controls.className = "venn-toolbar-controls";
            const style = document.createElement("style");
            style.textContent = `
                .venn-toolbar-controls {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    flex: 1 1 auto;
                    min-width: 0;
                }
                .venn-toolbar-controls > .dm-el {
                    position: static !important;
                    inset: auto !important;
                    flex: 0 0 auto;
                }
                .venn-toolbar-controls > .dm-label { width: auto !important; }
                .venn-toolbar-controls > .dm-select {
                    flex: 0 1 150px;
                    min-width: 60px;
                }
                .venn-toolbar-controls > .dm-select select { width: 100% !important; }
                .venn-toolbar-controls > .dm-input {
                    flex: 1 1 180px;
                    min-width: 60px;
                }
                .venn-toolbar-controls > .dm-input textarea {
                    width: 100% !important;
                    box-sizing: border-box;
                }
            `;
            controls.appendChild(style);
            toolbarControls.set(host, controls);
        }
        for (const name of [source.customCheckbox, source.customLabel, source.truthTableSelect, source.customInput]) {
            const node = options.api.getElementNode?.(asString(name));
            if (node instanceof HTMLElement) {
                const wrapper = node.closest<HTMLElement>(".dm-el") || node;
                if (wrapper.parentElement !== controls) {
                    controls.appendChild(wrapper);
                }
            }
        }
        return controls;
    };

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
        delete nextPayload.resetButton;

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

        const resetNode = options.api.getElementNode?.(asString(source.resetButton));
        const resetButton = getPlotResetButton(resetNode);
        if (resetNode instanceof HTMLElement) {
            const container = resetNode.closest<HTMLElement>(".dm-el") || resetNode;
            container.style.display = "none";
        }
        renderVennDiagram(host, nextPayload, {
            toolbarHost: getPlotToolbarHost(host),
            toolbarControls: moveControlsToToolbar(host, source),
            reset: resetButton ? () => resetButton.click() : undefined,
            resetLabel: asString(resetButton?.textContent) || "Reset",
            windowTitle: document.title || "Venn diagram"
        });

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
                ...source,
                target: source.target,
                resetButton: source.resetButton,
                conditions: [],
                ids: [],
                out: [],
                cases: [],
                showCustom: false,
                customText: ""
            });
        }

        return render({
            ...source,
            target: source.target,
            resetButton: source.resetButton,
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
