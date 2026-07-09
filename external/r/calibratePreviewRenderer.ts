import type {
    DialogQcaRuntimeApi
} from "./runtimeApi";
import {
    asPayloadRecord,
    asString
} from "./runtimeApi";


interface ThresholdMarker {
    index: number;
    numeric: number;
}


interface CalibratePlotPoint {
    x: number;
    fuzzy: number;
    rowName: string;
}


interface CalibratePreviewPayload {
    target: string;
    thresholdInputIds: string[];
    thresholdValues: string[];
    visibleThresholdCount: number;
    thresholds: ThresholdMarker[];
    plotPoints: CalibratePlotPoint[];
    selectedDataset: string;
    selectedVariable: string;
    variableValuesLoading: boolean;
    variableValuesError: string;
    hasFuzzyCurve: boolean;
    jitterEnabled: boolean;
    jitterOffsets: number[];
    dialogConfig: Record<string, unknown> | null;
}


interface CalibratePreviewRendererOptions {
    api: DialogQcaRuntimeApi;
    buildThresholdInsertion: (payload: unknown) => string[];
    onThresholdValuesChanged: (
        dialogConfig: Record<string, unknown>,
        values: string[]
    ) => Promise<void>;
}


const SVG_NS = "http://www.w3.org/2000/svg";


const createSvgElement = function(
    name: string,
    attributes: Record<string, string | number>
): SVGElement {
    const element = document.createElementNS(SVG_NS, name);

    Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, String(value));
    });

    return element;
};


const normalizePayload = function(payload: unknown): CalibratePreviewPayload {
    const source = asPayloadRecord(payload);
    const readStrings = function(value: unknown): string[] {
        return Array.isArray(value) ? value.map(asString) : [];
    };
    const thresholds = Array.isArray(source.thresholds)
        ? source.thresholds.map((item) => {
            const entry = asPayloadRecord(item);
            const numeric = Number(entry.numeric);

            return {
                index: Math.max(0, Number(entry.index) || 0),
                numeric
            };
        }).filter((item) => {
            return Number.isFinite(item.numeric);
        })
        : [];
    const plotPoints = Array.isArray(source.plotPoints)
        ? source.plotPoints.map((item) => {
            const entry = asPayloadRecord(item);

            return {
                x: Number(entry.x),
                fuzzy: Number(entry.fuzzy),
                rowName: asString(entry.rowName)
            };
        }).filter((item) => {
            return Number.isFinite(item.x);
        })
        : [];

    return {
        target: asString(source.target),
        thresholdInputIds: readStrings(source.thresholdInputIds),
        thresholdValues: readStrings(source.thresholdValues),
        visibleThresholdCount: Math.max(
            0,
            Number(source.visibleThresholdCount) || 0
        ),
        thresholds,
        plotPoints,
        selectedDataset: asString(source.selectedDataset),
        selectedVariable: asString(source.selectedVariable),
        variableValuesLoading: source.variableValuesLoading === true,
        variableValuesError: asString(source.variableValuesError),
        hasFuzzyCurve: source.hasFuzzyCurve === true,
        jitterEnabled: source.jitterEnabled === true,
        jitterOffsets: Array.isArray(source.jitterOffsets)
            ? source.jitterOffsets.map(Number).filter(Number.isFinite)
            : [],
        dialogConfig: Object.keys(asPayloadRecord(source.dialogConfig)).length
            ? asPayloadRecord(source.dialogConfig)
            : null
    };
};


const prettyTicks = function(min: number, max: number, count = 5): number[] {
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
        return [];
    }

    if (min === max) {
        return [min];
    }

    const span = Math.abs(max - min);
    const rawStep = span / Math.max(1, count);
    const power = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const error = rawStep / power;
    let step = power;

    if (error >= 10) {
        step = 10 * power;
    } else if (error >= 5) {
        step = 5 * power;
    } else if (error >= 2) {
        step = 2 * power;
    }

    const start = Math.ceil(min / step) * step;
    const end = Math.floor(max / step) * step;
    const ticks: number[] = [];

    for (let value = start; value <= end + step * 0.5; value += step) {
        ticks.push(Math.round((value + Number.EPSILON) / step) * step);

        if (ticks.length > 20) {
            break;
        }
    }

    return ticks.length ? ticks : [min, max];
};


const formatPrettyTick = function(value: number): string {
    if (!Number.isFinite(value)) {
        return "";
    }

    const absolute = Math.abs(value);

    if (absolute >= 1000 || Number.isInteger(value)) {
        return String(Math.round(value));
    }

    return absolute >= 1
        ? String(Math.round(value * 100) / 100)
        : String(Math.round(value * 1000) / 1000);
};


const appendCenteredNote = function(
    svg: SVGElement,
    width: number,
    height: number,
    text: string
): void {
    const note = createSvgElement("text", {
        x: width / 2,
        y: height / 2,
        "text-anchor": "middle",
        "font-size": 11,
        fill: "#6d6d6d"
    });

    note.textContent = text;
    svg.appendChild(note);
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


export const createCalibratePreviewRenderer = function(
    options: CalibratePreviewRendererOptions
) {
    const render = async function(payload: unknown): Promise<null> {
        const source = normalizePayload(payload);
        const host = options.api.getElementNode?.(source.target);

        if (!(host instanceof HTMLElement)) {
            throw new Error(
                "qca.renderCalibratePreview expects a target Plot element name"
            );
        }

        const applyThresholdValues = function(values: string[]): void {
            source.thresholdInputIds.forEach((inputId, index) => {
                if (inputId && index < source.visibleThresholdCount) {
                    options.api.setValue?.(inputId, values[index] ?? "");
                }
            });
        };
        const persistThresholdValues = async function(values: string[]): Promise<void> {
            applyThresholdValues(values);

            if (source.dialogConfig) {
                await options.onThresholdValuesChanged(
                    source.dialogConfig,
                    values
                );
            }
        };
        const insertThreshold = async function(value: number): Promise<void> {
            const values = options.buildThresholdInsertion({
                thresholdInputIds: source.thresholdInputIds,
                visibleThresholdCount: source.visibleThresholdCount,
                value
            });

            if (values.length) {
                await persistThresholdValues(values);
            }
        };

        host.replaceChildren();
        host.style.position = "relative";

        const width = Math.max(120, host.clientWidth || 430);
        const height = Math.max(100, host.clientHeight || 190);
        const svg = createSvgElement("svg", {
            viewBox: `0 0 ${width} ${height}`,
            width: "100%",
            height: "100%"
        });

        svg.setAttribute(
            "style",
            "display: block; user-select: none; -webkit-user-select: none;"
        );
        host.appendChild(svg);

        const tooltip = createTooltip(host);
        const showTooltip = function(event: MouseEvent, text: string): void {
            tooltip.textContent = text;
            tooltip.style.display = "block";
            tooltip.style.transform = "none";
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
        const left = 22;
        const right = width - 8;
        const bottom = height - 24;
        const top = 8;
        const fuzzyAxisTop = top + 4;
        const fuzzyAxisBottom = bottom - 10;
        const fuzzyAxisHeight = Math.max(40, fuzzyAxisBottom - fuzzyAxisTop);

        svg.appendChild(createSvgElement("rect", {
            x: 0.5,
            y: 0.5,
            width: width - 1,
            height: height - 1,
            fill: "#ffffff",
            stroke: "#c9c9c9"
        }));
        svg.appendChild(createSvgElement("line", {
            x1: left,
            y1: bottom,
            x2: right,
            y2: bottom,
            stroke: "#111111",
            "stroke-width": 1
        }));

        if (!source.selectedDataset || !source.selectedVariable) {
            appendCenteredNote(
                svg,
                width,
                height,
                "Select a dataset and a condition"
            );
            return null;
        }

        if (source.variableValuesLoading) {
            appendCenteredNote(svg, width, height, "Loading values from R...");
            return null;
        }

        const plotValues = source.plotPoints.map((point) => point.x);
        const domainValues = plotValues.length
            ? plotValues
            : source.thresholds.map((item) => item.numeric);

        if (!domainValues.length) {
            appendCenteredNote(
                svg,
                width,
                height,
                source.variableValuesError
                || "Select a numeric condition to plot its values"
            );
            return null;
        }

        const min = Math.min(...domainValues);
        const max = Math.max(...domainValues);
        const padding = Math.max(1, max - min) * 0.08;
        const domainMin = min - padding;
        const domainMax = max + padding;
        const toX = function(value: number): number {
            return left
                + ((value - domainMin) / (domainMax - domainMin || 1))
                * (right - left);
        };
        const fromX = function(screenX: number): number {
            const ratio = (
                Math.max(left, Math.min(right, screenX)) - left
            ) / Math.max(1, right - left);

            return domainMin + ratio * (domainMax - domainMin);
        };

        prettyTicks(domainMin, domainMax).forEach((tickValue) => {
            const x = toX(tickValue);
            const label = createSvgElement("text", {
                x,
                y: bottom + 21,
                "font-size": 10,
                "text-anchor": "middle"
            });

            svg.appendChild(createSvgElement("line", {
                x1: x,
                y1: bottom,
                x2: x,
                y2: bottom + 5,
                stroke: "#111111",
                "stroke-width": 1
            }));
            label.textContent = formatPrettyTick(tickValue);
            svg.appendChild(label);
        });

        svg.addEventListener("dblclick", async (event) => {
            event.preventDefault();
            event.stopPropagation();

            try {
                window.getSelection()?.removeAllRanges();
            } catch {
                // Selection cleanup is cosmetic and can fail during teardown.
            }

            const rect = host.getBoundingClientRect();
            const localX = event.clientX - rect.left;
            const localY = event.clientY - rect.top;

            if (
                localX < left
                || localX > right
                || localY < top
                || localY > bottom + 12
            ) {
                return;
            }

            await insertThreshold(fromX(localX));
        });

        if (source.hasFuzzyCurve) {
            [0, 0.5, 1].forEach((tickValue) => {
                const y = fuzzyAxisBottom - fuzzyAxisHeight * tickValue;
                const label = createSvgElement("text", {
                    x: left - 8,
                    y: y + 3,
                    "font-size": 10,
                    "text-anchor": "end"
                });

                svg.appendChild(createSvgElement("line", {
                    x1: left - 5,
                    y1: y,
                    x2: left,
                    y2: y,
                    stroke: "#111111",
                    "stroke-width": 1
                }));
                label.textContent = String(tickValue).replace(/^0\./, ".");
                svg.appendChild(label);
            });
            svg.appendChild(createSvgElement("line", {
                x1: left,
                y1: fuzzyAxisTop,
                x2: left,
                y2: fuzzyAxisBottom,
                stroke: "#111111",
                "stroke-width": 1
            }));
        }

        const pointBaseY = bottom - 24;

        source.plotPoints.forEach((pointData, index) => {
            const x = toX(pointData.x);
            const offset = source.jitterEnabled
                ? source.jitterOffsets[index] || 0
                : 0;
            const y = Number.isFinite(pointData.fuzzy)
                ? fuzzyAxisBottom
                    - fuzzyAxisHeight
                    * Math.max(0, Math.min(1, pointData.fuzzy))
                : Math.max(top + 32, pointBaseY - offset);
            const point = createSvgElement("circle", {
                cx: x,
                cy: y,
                r: 3.2,
                fill: "#ffffff",
                stroke: "#111111",
                "stroke-width": 1
            });

            point.addEventListener("mouseenter", (event) => {
                showTooltip(event as MouseEvent, pointData.rowName);
            });
            point.addEventListener("mousemove", (event) => {
                moveTooltip(event as MouseEvent);
            });
            point.addEventListener("mouseleave", hideTooltip);
            svg.appendChild(point);
        });

        source.thresholds.forEach((item) => {
            const initialX = toX(item.numeric);
            const thresholdLine = createSvgElement("line", {
                x1: initialX,
                y1: top,
                x2: initialX,
                y2: bottom,
                stroke: "#cb2626",
                "stroke-width": 1.2,
                style: "cursor: ew-resize;"
            });
            const thresholdHandle = createSvgElement("path", {
                d: `M ${initialX} ${bottom} L ${initialX - 6} ${bottom + 10} L ${initialX + 6} ${bottom + 10} Z`,
                fill: "#cb2626",
                style: "cursor: ew-resize;"
            });
            const dragLine = createSvgElement("line", {
                x1: initialX,
                y1: top,
                x2: initialX,
                y2: bottom,
                stroke: "transparent",
                "stroke-width": 4,
                style: "cursor: ew-resize;"
            });
            let dragStartX = 0;
            let dragStartValue = item.numeric;
            let pendingValue = item.numeric;

            const updateVisual = function(value: number): void {
                const x = Math.max(left, Math.min(right, toX(value)));

                thresholdLine.setAttribute("x1", String(x));
                thresholdLine.setAttribute("x2", String(x));
                thresholdHandle.setAttribute(
                    "d",
                    `M ${x} ${bottom} L ${x - 6} ${bottom + 10} L ${x + 6} ${bottom + 10} Z`
                );
                dragLine.setAttribute("x1", String(x));
                dragLine.setAttribute("x2", String(x));
            };
            const handleMove = function(event: PointerEvent): void {
                const delta = event.clientX - dragStartX;
                const value = dragStartValue
                    + (delta / Math.max(40, right - left))
                    * (domainMax - domainMin);

                pendingValue = Math.round(value * 1000) / 1000;
                updateVisual(pendingValue);
            };
            const stopDrag = async function(): Promise<void> {
                window.removeEventListener("pointermove", handleMove);
                window.removeEventListener("pointerup", stopDrag);

                const inputId = source.thresholdInputIds[item.index];

                if (!inputId) {
                    return;
                }

                const values = source.thresholdValues.slice();

                values[item.index] = String(pendingValue);
                await persistThresholdValues(values);
            };
            const startDrag = function(event: PointerEvent): void {
                dragStartX = event.clientX;
                dragStartValue = item.numeric;
                pendingValue = item.numeric;
                updateVisual(pendingValue);
                window.addEventListener("pointermove", handleMove);
                window.addEventListener("pointerup", stopDrag);
            };

            dragLine.addEventListener("pointerdown", startDrag);
            thresholdLine.addEventListener("pointerdown", startDrag);
            thresholdHandle.addEventListener("pointerdown", startDrag);
            svg.appendChild(thresholdLine);
            svg.appendChild(thresholdHandle);
            svg.appendChild(dragLine);
        });

        return null;
    };

    return {
        render
    };
};
