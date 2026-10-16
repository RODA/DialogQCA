import { getPlotResetButton, getPlotToolbarHost } from "../../qca/svgPlotToolbar";
import { renderFissChart } from "../../qca/fissRenderer";
import {
    normalizeQcaFissDialogState,
    type QcaFissDialogState
} from "../../qca/qcaFissDialog";
import type { DialogQcaRuntimeApi } from "./runtimeApi";
import {
    asPayloadRecord,
    asString,
    firstSelected
} from "./runtimeApi";


export const createFissDialogRuntime = function(options: {
    api: DialogQcaRuntimeApi;
    invoke: (
        name: string,
        parameters?: Record<string, unknown>
    ) => Promise<unknown>;
}) {
    const decodeHex = function(value: unknown): Uint8Array {
        const hex = asString(value);
        if (!hex || hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) {
            return new Uint8Array(0);
        }
        const output = new Uint8Array(hex.length / 2);
        for (let index = 0; index < output.length; index += 1) {
            output[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
        }
        return output;
    };
    const selected = function(control: unknown): string {
        const name = asString(control);

        return name ? firstSelected(options.api.getSelected?.(name)) : "";
    };
    const value = function(control: unknown): string {
        const name = asString(control);

        if (name) {
            const node = options.api.getElementNode?.(name);
            const field = node instanceof HTMLTextAreaElement
                || node instanceof HTMLInputElement
                ? node
                : node instanceof HTMLElement
                    ? node.querySelector("textarea, input")
                    : null;

            if (
                field instanceof HTMLTextAreaElement
                || field instanceof HTMLInputElement
            ) {
                return field.value;
            }
        }

        return name ? asString(options.api.getValue?.(name)) : "";
    };
    const strings = function(value: unknown): string[] {
        return Array.isArray(value)
            ? value.map((entry) => asString(entry))
            : value == null || value === ""
                ? []
                : [asString(value)];
    };
    const sameStrings = function(left: unknown, right: string[]): boolean {
        const current = strings(left);

        return current.length === right.length && current.every((entry, index) => {
            return entry === right[index];
        });
    };
    const setSelect = function(control: unknown, values: string[], selection: string): void {
        const name = asString(control);

        if (!name) {
            return;
        }

        const node = options.api.getElementNode?.(name);
        const select = node instanceof HTMLSelectElement
            ? node
            : node instanceof HTMLElement
                ? node.querySelector("select")
                : null;
        const currentValues = select
            ? Array.from(select.options, (option) => option.value)
            : options.api.getValue?.(name);

        if (!sameStrings(currentValues, values)) {
            options.api.setValue?.(name, values);
        }

        const nextSelection = selection ? [selection] : [];

        if (!sameStrings(options.api.getSelected?.(name), nextSelection)) {
            options.api.setSelected?.(name, selection);
        }
    };
    const setVisible = function(control: unknown, visible: boolean): void {
        const name = asString(control);

        if (!name) {
            return;
        }

        if (visible) {
            options.api.show?.(name);
        } else {
            options.api.hide?.(name);
        }
    };
    let synchronizationGeneration = 0;
    let automaticTitle = true;
    const apply = function(
        source: Record<string, unknown>,
        state: QcaFissDialogState,
        applyOptions: { preserveTitle?: boolean } = {}
    ): void {
        setSelect(source.solutionSelect, state.solutionNames, state.selectedSolution);
        setSelect(source.branchSelect, state.branches, state.selectedBranch);
        setSelect(source.modelSelect, state.models, state.selectedModel);
        setSelect(
            source.ambiguitySelect,
            state.ambiguities.map((entry) => entry.configuration),
            state.selectedAmbiguity
        );
        setSelect(source.coreTermSelect, state.coreCandidates, state.selectedCoreTerm);
        if (!applyOptions.preserveTitle) {
            options.api.setValue?.(asString(source.titleInput), state.title);
        }
        options.api.setValue?.(asString(source.messageLabel), state.message);

        const legendName = asString(source.legendCheckbox);
        const legendChecked = options.api.isChecked?.(legendName) === true;

        if (state.legend && !legendChecked) {
            options.api.check?.(asString(source.legendCheckbox));
        } else if (!state.legend && legendChecked) {
            options.api.uncheck?.(asString(source.legendCheckbox));
        }

        const labelsName = asString(source.labelsCheckbox);
        const labelsChecked = options.api.isChecked?.(labelsName) === true;
        if (state.useLabels && !labelsChecked) {
            options.api.check?.(labelsName);
        } else if (!state.useLabels && labelsChecked) {
            options.api.uncheck?.(labelsName);
        }

        const showAmbiguity = state.ambiguities.length > 0;

        setVisible(source.ambiguityLabel, showAmbiguity);
        setVisible(source.ambiguitySelect, showAmbiguity);
        setVisible(source.coreTermLabel, showAmbiguity);
        setVisible(source.coreTermSelect, showAmbiguity);
        options.api.updateSyntax?.(state.command);

        const plot = options.api.getElementNode?.(asString(source.plot));

        if (plot instanceof HTMLElement) {
            const resetNode = options.api.getElementNode?.(
                asString(source.resetButton)
            );
            const resetButton = getPlotResetButton(resetNode);
            const resetContainer = resetNode instanceof HTMLElement
                ? resetNode.closest<HTMLElement>(".dm-el") || resetNode
                : null;

            if (resetContainer) {
                resetContainer.style.display = "none";
            }
            renderFissChart(plot, state.renderPayload, {
                toolbarHost: getPlotToolbarHost(plot),
                reset: resetButton ? () => resetButton.click() : undefined,
                resetLabel: asString(resetButton?.textContent) || "Reset",
                windowTitle: document.title || "Fiss chart",
                exportPdf: async () => {
                    const result = asPayloadRecord(await options.invoke(
                        "qca.exportFissPdf",
                        {
                            solutionName: state.selectedSolution,
                            branch: state.selectedBranch,
                            model: state.selectedModel,
                            ambiguity: state.selectedAmbiguity,
                            coreSelections: state.coreSelections,
                            title: state.title,
                            legend: state.legend,
                            useLabels: state.useLabels
                        }
                    ));

                    return {
                        data: decodeHex(result.dataHex),
                        width: Number(result.width || 0),
                        height: Number(result.height || 0)
                    };
                }
            });
        }
    };
    const synchronize = async function(payload: unknown): Promise<QcaFissDialogState> {
        const source = asPayloadRecord(payload);
        const eventName = asString(source.event);
        if (eventName === "init") {
            automaticTitle = true;
        } else if (eventName === "title") {
            automaticTitle = value(source.titleInput).trim() === "";
        }
        const generation = synchronizationGeneration + 1;
        synchronizationGeneration = generation;
        const state = normalizeQcaFissDialogState(await options.invoke(
            "qca.getFissDialogState",
            {
                solutionName: selected(source.solutionSelect),
                branch: selected(source.branchSelect),
                model: selected(source.modelSelect),
                ambiguity: selected(source.ambiguitySelect),
                coreSelections: asPayloadRecord(source.coreSelections),
                title: automaticTitle ? "" : value(source.titleInput),
                legend: options.api.isChecked?.(asString(source.legendCheckbox)) === true,
                useLabels: eventName === "init" || eventName === "solution"
                    ? undefined
                    : options.api.isChecked?.(asString(source.labelsCheckbox)) === true
            }
        ));

        if (generation === synchronizationGeneration) {
            apply(source, state, {
                preserveTitle: !automaticTitle
            });
        }

        return state;
    };

    return {
        apply,
        synchronize
    };
};
