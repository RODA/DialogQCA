import {
    getPlotResetButton,
    getPlotToolbarHost,
    setPlotToolbarExtraHeight
} from "../../qca/svgPlotToolbar";
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
                .plot-dialog-window-toolbar.venn-toolbar-expanded {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto;
                    grid-template-rows: 34px 34px;
                    gap: 0 6px;
                    height: 68px;
                }
                .venn-toolbar-expression {
                    position: static !important;
                    inset: auto !important;
                    grid-column: 1 / -1;
                    grid-row: 2;
                    width: 100% !important;
                    min-width: 0;
                }
                .venn-toolbar-expression textarea {
                    width: 100% !important;
                    box-sizing: border-box;
                }
            `;
            controls.appendChild(style);
            toolbarControls.set(host, controls);
        }
        for (const name of [source.customCheckbox, source.customLabel, source.truthTableSelect]) {
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
        const toolbarHost = getPlotToolbarHost(host);
        const expanded = options.api.isChecked?.(asString(source.customCheckbox)) === true;
        const wasExpanded = toolbarHost?.dataset.customExpanded === "true";
        const input = options.api.getElementNode?.(asString(source.customInput));
        const expression = input instanceof HTMLElement
            ? input.closest<HTMLElement>(".dm-el") || input
            : undefined;
        expression?.classList.add("venn-toolbar-expression");
        setPlotToolbarExtraHeight(host, expanded ? 34 : 0);
        renderVennDiagram(host, nextPayload, {
            toolbarHost,
            toolbarControls: moveControlsToToolbar(host, source),
            toolbarExpression: expression,
            toolbarExpanded: expanded,
            reset: resetButton ? () => resetButton.click() : undefined,
            resetLabel: asString(resetButton?.textContent) || "Reset",
            windowTitle: document.title || "Venn diagram"
        });

        if (toolbarHost) {
            toolbarHost.style.height = expanded ? "68px" : "34px";
            toolbarHost.dataset.customExpanded = String(expanded);
            if (expanded && !wasExpanded && input instanceof HTMLElement) {
                // Wait for window resizing and its diagram redraw before focusing.
                requestAnimationFrame(() => {
                    if (toolbarHost.dataset.customExpanded === "true") {
                        const field = input.matches("input, textarea")
                            ? input
                            : input.querySelector<HTMLElement>("input, textarea");
                        field?.focus({ preventScroll: true });
                    }
                });
            }
        }

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
