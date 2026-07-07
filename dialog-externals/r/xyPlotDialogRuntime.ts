import type {
    DialogQcaRuntimeApi
} from "./runtimeApi";
import {
    asPayloadRecord,
    asString,
    firstSelected
} from "./runtimeApi";


interface XYPlotDialogConfig {
    dialogKey: string;
    datasetContainer: string;
    xContainer: string;
    yContainer: string;
    plot: string;
    sufficiencyRadio: string;
    necessityRadio: string;
    negateXCheckbox: string;
    negateYCheckbox: string;
    pofCheckbox: string;
    guidesCheckbox: string;
    fillCheckbox: string;
    jitterCheckbox: string;
    casesCheckbox: string;
    rotateInput: string;
    rotateLabel: string;
    xAxisLabel: string;
    yAxisLabel: string;
    measureLabels: string[];
    measureValues: string[];
    separators: string[];
    event: string;
}


interface XYPlotData extends Record<string, unknown> {
    x?: unknown[] | Record<string, unknown>;
    y?: unknown[] | Record<string, unknown>;
    labels?: unknown[] | Record<string, unknown>;
    necessity?: unknown[];
    sufficiency?: unknown[];
}


interface XYPlotDialogState {
    selectedDataset: string;
    selectedX: string;
    selectedY: string;
    plotData: XYPlotData | null;
    plotLoading: boolean;
    plotRequestKey: string;
    jitterEnabled: boolean;
    jitterOffsets: {
        x: number[];
        y: number[];
    };
}


interface XYPlotDialogOptions {
    api: DialogQcaRuntimeApi;
    getDialogKey: (prefix: string, payload: unknown) => string;
    setVisible: (elementName: string, visible: boolean) => void;
    setLabelWeight: (elementName: string, weight?: string) => void;
    getDatasetVariables: (
        dataset: string
    ) => Promise<Record<string, unknown>[] | null>;
    getVariableValues: (
        dataset: string,
        variable: string
    ) => Promise<unknown>;
    listDatasetColumns: (dataset: string) => string[];
    invoke: (
        channel: string,
        payload?: Record<string, unknown>
    ) => Promise<unknown>;
}


const SVG_NS = "http://www.w3.org/2000/svg";


const createSvgElement = function(
    name: string,
    attributes: Record<string, string | number>
): SVGElement {
    const element = document.createElementNS(SVG_NS, name);

    Object.entries(attributes).forEach(([key, value]) => {
        if (value !== "") {
            element.setAttribute(key, String(value));
        }
    });

    return element;
};


const asValueArray = function(value: unknown): unknown[] {
    if (Array.isArray(value)) {
        return value;
    }

    return value && typeof value === "object"
        ? Object.values(value)
        : [];
};


const createInitialState = function(): XYPlotDialogState {
    return {
        selectedDataset: "",
        selectedX: "",
        selectedY: "",
        plotData: null,
        plotLoading: false,
        plotRequestKey: "",
        jitterEnabled: false,
        jitterOffsets: {
            x: [],
            y: []
        }
    };
};


export const createXYPlotDialogRuntime = function(options: XYPlotDialogOptions) {
    const states = new Map<string, XYPlotDialogState>();

    const getConfig = function(payload: unknown): XYPlotDialogConfig {
        const source = asPayloadRecord(payload);
        const readNames = function(value: unknown): string[] {
            return Array.isArray(value) ? value.map(asString).filter(Boolean) : [];
        };

        return {
            dialogKey: options.getDialogKey("xyplot", payload),
            datasetContainer: asString(source.datasetContainer),
            xContainer: asString(source.xContainer),
            yContainer: asString(source.yContainer),
            plot: asString(source.plot),
            sufficiencyRadio: asString(source.sufficiencyRadio),
            necessityRadio: asString(source.necessityRadio),
            negateXCheckbox: asString(source.negateXCheckbox),
            negateYCheckbox: asString(source.negateYCheckbox),
            pofCheckbox: asString(source.pofCheckbox),
            guidesCheckbox: asString(source.guidesCheckbox),
            fillCheckbox: asString(source.fillCheckbox),
            jitterCheckbox: asString(source.jitterCheckbox),
            casesCheckbox: asString(source.casesCheckbox),
            rotateInput: asString(source.rotateInput),
            rotateLabel: asString(source.rotateLabel),
            xAxisLabel: asString(source.xAxisLabel),
            yAxisLabel: asString(source.yAxisLabel),
            measureLabels: readNames(source.measureLabels),
            measureValues: readNames(source.measureValues),
            separators: readNames(source.separators),
            event: asString(source.event)
        };
    };

    const getState = function(dialogKey: string): XYPlotDialogState {
        if (!states.has(dialogKey)) {
            states.set(dialogKey, createInitialState());
        }

        return states.get(dialogKey)!;
    };

    const valuesAreCalibrated = function(values: unknown[]): boolean {
        const finiteValues = values.map(Number).filter(Number.isFinite);

        return finiteValues.length > 0 && finiteValues.every((value) => {
            return value >= 0 && value <= 1;
        });
    };

    const classifyColumns = async function(
        dataset: string,
        columns: string[]
    ): Promise<Array<{
        name: string;
        enabled: boolean;
        numeric: boolean;
        calibrated: boolean;
    }>> {
        const entries: Array<{
            name: string;
            enabled: boolean;
            numeric: boolean;
            calibrated: boolean;
        }> = [];

        for (const name of columns) {
            if (!name) {
                continue;
            }

            const info = asPayloadRecord(
                await options.getVariableValues(dataset, name)
            );
            const values = Array.isArray(info.values) ? info.values : [];
            const numeric = info.isNumeric === true;
            const calibrated = numeric && valuesAreCalibrated(values);

            entries.push({
                name,
                enabled: calibrated,
                numeric,
                calibrated
            });
        }

        return entries;
    };

    const rebuildJitter = function(state: XYPlotDialogState): void {
        const size = asValueArray(state.plotData?.labels).length;

        state.jitterOffsets = {
            x: new Array(size).fill(0),
            y: new Array(size).fill(0)
        };

        for (let index = 0; index < size; index += 1) {
            state.jitterOffsets.x[index] = Math.random() * 10 - 5;
            state.jitterOffsets.y[index] = Math.random() * 10 - 5;
        }
    };

    const createTooltip = function(host: HTMLElement): HTMLDivElement {
        const tooltip = document.createElement("div");

        tooltip.style.position = "absolute";
        tooltip.style.pointerEvents = "none";
        tooltip.style.display = "none";
        tooltip.style.padding = "3px 6px";
        tooltip.style.border = "1px solid #9a9a9a";
        tooltip.style.borderRadius = "4px";
        tooltip.style.background = "rgba(255,255,255,0.96)";
        tooltip.style.color = "#222222";
        tooltip.style.fontSize = "11px";
        tooltip.style.lineHeight = "1.2";
        tooltip.style.boxShadow = "0 1px 4px rgba(0,0,0,0.12)";
        tooltip.style.zIndex = "2";
        host.appendChild(tooltip);

        return tooltip;
    };

    const positionTooltip = function(
        host: HTMLElement,
        tooltip: HTMLDivElement,
        event: MouseEvent
    ): void {
        const rect = host.getBoundingClientRect();
        const tooltipWidth = tooltip.offsetWidth || 80;
        const tooltipHeight = tooltip.offsetHeight || 20;
        const left = Math.max(
            8,
            Math.min(
                rect.width - tooltipWidth - 8,
                event.clientX - rect.left + 10
            )
        );
        let top = event.clientY - rect.top - tooltipHeight - 10;

        if (top < 8) {
            top = Math.min(
                rect.height - tooltipHeight - 8,
                event.clientY - rect.top + 12
            );
        }

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${Math.max(8, top)}px`;
    };

    const renderPlot = function(
        config: XYPlotDialogConfig,
        state: XYPlotDialogState
    ): void {
        const host = options.api.getElementNode?.(config.plot);

        if (!(host instanceof HTMLElement)) {
            return;
        }

        host.replaceChildren();

        const width = host.clientWidth || 545;
        const height = host.clientHeight || 535;
        const svg = createSvgElement("svg", {
            viewBox: `0 0 ${width} ${height}`,
            width,
            height
        });

        svg.setAttribute("style", "display: block; overflow: visible;");
        host.appendChild(svg);

        const tooltip = createTooltip(host);
        const showTooltip = function(event: MouseEvent, text: string): void {
            tooltip.textContent = text;
            tooltip.style.display = "block";
            positionTooltip(host, tooltip, event);
        };
        const moveTooltip = function(event: MouseEvent): void {
            if (tooltip.style.display === "block") {
                positionTooltip(host, tooltip, event);
            }
        };
        const hideTooltip = function(): void {
            tooltip.style.display = "none";
        };
        const squareLeft = 45;
        const squareTop = 0;
        const squareSize = 500;
        const squareRight = squareLeft + squareSize;
        const squareBottom = squareTop + squareSize;
        const inset = 8;
        const plotLeft = squareLeft + inset;
        const plotTop = squareTop + inset;
        const plotRight = squareRight - inset;
        const plotBottom = squareBottom - inset;
        const plotSize = plotRight - plotLeft;
        const xValues = asValueArray(state.plotData?.x);
        const yValues = asValueArray(state.plotData?.y);
        const labels = asValueArray(state.plotData?.labels);
        const frameLines: Array<Record<string, string | number>> = [
            {
                x1: squareLeft,
                y1: squareTop,
                x2: squareRight,
                y2: squareTop,
                stroke: "#000000",
                "stroke-width": 1
            },
            {
                x1: squareLeft,
                y1: squareTop,
                x2: squareLeft,
                y2: squareBottom,
                stroke: "#000000",
                "stroke-width": 1
            },
            {
                x1: squareLeft,
                y1: squareBottom,
                x2: squareRight,
                y2: squareBottom,
                stroke: "#000000",
                "stroke-width": 1
            },
            {
                x1: squareRight,
                y1: squareTop,
                x2: squareRight,
                y2: squareBottom,
                stroke: "#000000",
                "stroke-width": 1
            },
            {
                x1: squareLeft,
                y1: squareBottom,
                x2: squareRight,
                y2: squareTop,
                stroke: "#a0a0a0",
                "stroke-width": 1.2
            }
        ];

        frameLines.forEach((attributes) => {
            svg.appendChild(createSvgElement("line", attributes));
        });

        if (options.api.isChecked?.(config.guidesCheckbox)) {
            svg.appendChild(createSvgElement("line", {
                x1: squareLeft,
                y1: squareTop + squareSize / 2,
                x2: squareRight,
                y2: squareTop + squareSize / 2,
                stroke: "#a0a0a0",
                "stroke-width": 1,
                "stroke-dasharray": "8 6"
            }));
            svg.appendChild(createSvgElement("line", {
                x1: squareLeft + squareSize / 2,
                y1: squareTop,
                x2: squareLeft + squareSize / 2,
                y2: squareBottom,
                stroke: "#a0a0a0",
                "stroke-width": 1,
                "stroke-dasharray": "8 6"
            }));
        }

        for (let index = 0; index <= 10; index += 1) {
            const value = index / 10;
            const x = plotLeft + plotSize * value;
            const y = plotBottom - plotSize * value;
            const label = value === 0 || value === 1
                ? String(value)
                : String(Math.round(value * 10) / 10);
            const xText = createSvgElement("text", {
                x,
                y: squareBottom + 20,
                "text-anchor": "middle",
                "font-size": 12,
                fill: "#000000"
            });
            const yText = createSvgElement("text", {
                x: squareLeft - 11,
                y: y + 4,
                "text-anchor": "end",
                "font-size": 12,
                fill: "#000000"
            });

            svg.appendChild(createSvgElement("line", {
                x1: x,
                y1: squareBottom,
                x2: x,
                y2: squareBottom + 7,
                stroke: "#000000",
                "stroke-width": 1
            }));
            svg.appendChild(createSvgElement("line", {
                x1: squareLeft - 7,
                y1: y,
                x2: squareLeft,
                y2: y,
                stroke: "#000000",
                "stroke-width": 1
            }));
            xText.textContent = label;
            yText.textContent = label;
            svg.appendChild(xText);
            svg.appendChild(yText);
        }

        if (state.plotLoading) {
            const loading = createSvgElement("text", {
                x: squareLeft + squareSize / 2,
                y: squareTop + squareSize / 2,
                "text-anchor": "middle",
                "font-size": 14,
                fill: "#666666"
            });

            loading.textContent = "Loading...";
            svg.appendChild(loading);
            return;
        }

        if (!state.plotData || !xValues.length || !yValues.length) {
            return;
        }

        const fillOpacity = options.api.isChecked?.(config.fillCheckbox) ? 1 : 0;
        const showLabels = options.api.isChecked?.(config.casesCheckbox) === true;
        const rotation = Math.round(
            (Number(options.api.getValue?.(config.rotateInput)) || 0) * 45
        );
        const pointCount = Math.min(
            xValues.length,
            yValues.length,
            labels.length || Math.min(xValues.length, yValues.length)
        );

        for (let index = 0; index < pointCount; index += 1) {
            const rawX = Number(xValues[index]);
            const rawY = Number(yValues[index]);

            if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) {
                continue;
            }

            const xValue = options.api.isChecked?.(config.negateXCheckbox)
                ? 1 - rawX
                : rawX;
            const yValue = options.api.isChecked?.(config.negateYCheckbox)
                ? rawY
                : 1 - rawY;
            const x = plotLeft + plotSize * xValue + (
                options.api.isChecked?.(config.jitterCheckbox)
                    ? state.jitterOffsets.x[index] || 0
                    : 0
            );
            const y = plotTop + plotSize * yValue + (
                options.api.isChecked?.(config.jitterCheckbox)
                    ? state.jitterOffsets.y[index] || 0
                    : 0
            );
            const label = asString(labels[index]);
            const circle = createSvgElement("circle", {
                cx: x,
                cy: y,
                r: 3,
                fill: "#707070",
                "fill-opacity": fillOpacity,
                stroke: "#707070",
                "stroke-width": 1
            });

            if (label && !showLabels) {
                circle.addEventListener("mouseenter", (event) => {
                    showTooltip(event as MouseEvent, label);
                });
                circle.addEventListener("mousemove", (event) => {
                    moveTooltip(event as MouseEvent);
                });
                circle.addEventListener("mouseleave", hideTooltip);
            }

            svg.appendChild(circle);

            if (!showLabels) {
                continue;
            }

            const group = createSvgElement("g", {
                transform: rotation ? `rotate(${-rotation} ${x} ${y})` : ""
            });
            const placeLeft = x > plotLeft + plotSize - 100;
            const text = createSvgElement("text", {
                x: placeLeft ? x - 8 : x + 8,
                y: y + 4,
                "text-anchor": placeLeft ? "end" : "start",
                "font-size": 12,
                "font-weight": "700",
                fill: "#000000",
                "fill-opacity": 0.7
            });

            text.textContent = label;
            group.appendChild(text);
            svg.appendChild(group);
        }
    };

    const refresh = function(
        config: XYPlotDialogConfig,
        state: XYPlotDialogState
    ): void {
        const showRotation = options.api.isChecked?.(config.casesCheckbox) === true;

        options.setVisible(config.rotateInput, showRotation);
        options.setVisible(config.rotateLabel, showRotation);
        options.api.setValue?.(config.xAxisLabel, state.selectedX.toUpperCase());
        options.api.setValue?.(config.yAxisLabel, state.selectedY.toUpperCase());
        options.setVisible(config.xAxisLabel, !!state.selectedX);
        options.setVisible(config.yAxisLabel, !!state.selectedY);
        options.setLabelWeight(config.xAxisLabel);
        options.setLabelWeight(config.yAxisLabel);
        config.measureValues.forEach((name) => {
            options.setVisible(name, false);
        });

        const showMeasures = !!options.api.isChecked?.(config.pofCheckbox)
            && !!state.plotData
            && !!state.selectedX
            && !!state.selectedY;
        const necessity = options.api.isChecked?.(config.necessityRadio) === true;

        if (!showMeasures) {
            const defaults = [
                "Inclusion:",
                "Coverage:",
                necessity ? "Relevance:" : "PRI:"
            ];

            config.measureLabels.forEach((name, index) => {
                options.api.setValue?.(name, defaults[index] || "");
                options.setVisible(name, false);
            });
        } else {
            const bucket = necessity
                ? state.plotData?.necessity
                : state.plotData?.sufficiency;
            const index = (options.api.isChecked?.(config.negateXCheckbox) ? 1 : 0)
                + (options.api.isChecked?.(config.negateYCheckbox) ? 2 : 0);
            const row = Array.isArray(bucket) ? bucket[index] : null;

            if (Array.isArray(row) && row.length >= 3) {
                const labels = [
                    `Inclusion: ${String(row[0] || "")}`.trim(),
                    `Coverage: ${String(row[1] || "")}`.trim(),
                    `${necessity ? "Relevance:" : "PRI:"} ${String(row[2] || "")}`.trim()
                ];

                config.measureLabels.forEach((name, labelIndex) => {
                    options.api.setValue?.(name, labels[labelIndex] || "");
                    options.setVisible(name, true);
                    options.setLabelWeight(name);
                });
            } else {
                config.measureLabels.forEach((name) => {
                    options.setVisible(name, false);
                });
            }
        }

        renderPlot(config, state);
        options.api.updateSyntax?.("");
    };

    const requestPreview = async function(
        config: XYPlotDialogConfig,
        state: XYPlotDialogState
    ): Promise<void> {
        if (!state.selectedDataset || !state.selectedX || !state.selectedY) {
            state.plotLoading = false;
            state.plotRequestKey = "";
            state.plotData = null;
            refresh(config, state);
            return;
        }

        const requestKey = [
            state.selectedDataset,
            state.selectedX,
            state.selectedY
        ].join("::");

        state.plotRequestKey = requestKey;
        state.plotLoading = true;
        refresh(config, state);

        let result: unknown = null;

        try {
            result = await options.invoke("qca.getXYPlotPreview", {
                dataset: state.selectedDataset,
                xVariable: state.selectedX,
                yVariable: state.selectedY
            });
        } catch (error) {
            console.error("Unable to build QCA XY plot preview", error);
        }

        if (state.plotRequestKey !== requestKey) {
            return;
        }

        state.plotLoading = false;
        state.plotData = result && typeof result === "object"
            ? result as XYPlotData
            : null;
        rebuildJitter(state);
        state.jitterEnabled = options.api.isChecked?.(config.jitterCheckbox) === true;
        refresh(config, state);
    };

    const loadColumns = async function(
        config: XYPlotDialogConfig,
        state: XYPlotDialogState
    ): Promise<void> {
        const metadata = await options.getDatasetVariables(state.selectedDataset);
        const columns = metadata?.length
            ? metadata.map((item) => asString(item.name)).filter(Boolean)
            : options.listDatasetColumns(state.selectedDataset);
        const entries = await classifyColumns(state.selectedDataset, columns);

        options.api.setValue?.(config.xContainer, entries);
        options.api.setValue?.(config.yContainer, entries);
        state.selectedX = firstSelected(
            options.api.getSelected?.(config.xContainer)
        );
        state.selectedY = firstSelected(
            options.api.getSelected?.(config.yContainer)
        );
    };

    const synchronize = async function(payload: unknown): Promise<null> {
        const config = getConfig(payload);
        const state = getState(config.dialogKey);
        const event = config.event || "refresh";

        if (event === "init") {
            Object.assign(state, createInitialState());
            config.separators.forEach((name) => {
                options.setVisible(name, false);
            });
            state.selectedDataset = firstSelected(
                options.api.getSelected?.(config.datasetContainer)
            );

            if (state.selectedDataset) {
                await loadColumns(config, state);
                await requestPreview(config, state);
            } else {
                refresh(config, state);
            }

            return null;
        }

        if (event === "dataset") {
            state.selectedDataset = firstSelected(
                options.api.getSelected?.(config.datasetContainer)
            );
            state.selectedX = "";
            state.selectedY = "";
            state.plotData = null;

            if (!state.selectedDataset) {
                options.api.clearContent?.(config.xContainer, config.yContainer);
                refresh(config, state);
                return null;
            }

            await loadColumns(config, state);
            await requestPreview(config, state);
            return null;
        }

        if (event === "x") {
            state.selectedX = firstSelected(
                options.api.getSelected?.(config.xContainer)
            );
            await requestPreview(config, state);
            return null;
        }

        if (event === "y") {
            state.selectedY = firstSelected(
                options.api.getSelected?.(config.yContainer)
            );
            await requestPreview(config, state);
            return null;
        }

        const jitterEnabled = options.api.isChecked?.(config.jitterCheckbox) === true;

        if (jitterEnabled && !state.jitterEnabled) {
            rebuildJitter(state);
        }

        state.jitterEnabled = jitterEnabled;
        refresh(config, state);

        return null;
    };

    return {
        synchronize
    };
};
