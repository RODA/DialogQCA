import { createSvgPlotToolbar } from "./svgPlotToolbar";
import type { QcaFissRenderPayload } from "./qcaFissDialog";

const previewStates = new WeakMap<HTMLElement, { zoom: number; events: AbortController }>();

const SVG_NS = "http://www.w3.org/2000/svg";

export interface FissPdfExport {
    data: Uint8Array;
    width: number;
    height: number;
}

export interface FissRenderOptions {
    exportPdf?: () => Promise<FissPdfExport>;
    toolbarHost?: HTMLElement;
    reset?: () => void;
    resetLabel?: string;
    windowTitle?: string;
}

const svgElement = function<K extends keyof SVGElementTagNameMap>(
    name: K,
    attributes: Record<string, string | number> = {}
): SVGElementTagNameMap[K] {
    const element = document.createElementNS(SVG_NS, name);
    Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, String(value));
    });
    return element;
};

const addText = function(
    parent: SVGElement,
    text: string,
    x: number,
    y: number,
    options: { anchor?: "start" | "middle" | "end"; weight?: number; size?: number } = {}
): SVGTextElement {
    const node = svgElement("text", {
        x,
        y,
        "text-anchor": options.anchor || "start",
        "font-size": options.size || 12,
        "font-weight": options.weight || 400,
        fill: "currentColor"
    });
    node.textContent = text;
    parent.appendChild(node);
    return node;
};

const addRule = function(
    parent: SVGElement,
    x1: number,
    x2: number,
    y: number,
    width = 1
): void {
    parent.appendChild(svgElement("line", {
        x1,
        x2,
        y1: y,
        y2: y,
        stroke: "currentColor",
        "stroke-width": width
    }));
};

const addSymbol = function(
    parent: SVGElement,
    x: number,
    y: number,
    present: boolean,
    core: boolean
): void {
    const radius = core ? 7 : 4;
    parent.appendChild(svgElement("circle", {
        cx: x,
        cy: y,
        r: radius,
        fill: present ? "currentColor" : "none",
        stroke: "currentColor",
        "stroke-width": 1
    }));
    if (!present) {
        const offset = radius / Math.sqrt(2);
        parent.appendChild(svgElement("line", {
            x1: x - offset,
            y1: y - offset,
            x2: x + offset,
            y2: y + offset,
            stroke: "currentColor",
            "stroke-width": 1
        }));
        parent.appendChild(svgElement("line", {
            x1: x - offset,
            y1: y + offset,
            x2: x + offset,
            y2: y - offset,
            stroke: "currentColor",
            "stroke-width": 1
        }));
    }
};

const formatFit = function(value: number | null): string {
    return value === null ? "-" : value.toFixed(3);
};

export const renderFissChart = function(
    host: HTMLElement,
    payload: QcaFissRenderPayload,
    options: FissRenderOptions = {}
): void {
    const previous = previewStates.get(host);
    previous?.events.abort();
    const preview = { zoom: previous?.zoom || 1, events: new AbortController() };
    previewStates.set(host, preview);
    host.innerHTML = "";
    host.style.overflow = "hidden";
    host.style.position = "relative";

    const renderToolbar = function(svg: SVGSVGElement | null): HTMLElement {
        const toolbar = createSvgPlotToolbar({
            svg,
            title: payload.title,
            zoom: preview.zoom,
            signal: preview.events.signal,
            setZoom: (zoom) => {
                preview.zoom = zoom;
                if (svg) {
                    svg.style.width = `${svg.width.baseVal.value * zoom}px`;
                    svg.style.height = `${svg.height.baseVal.value * zoom}px`;
                }
            },
            exportPdf: options.exportPdf,
            reset: options.reset,
            resetLabel: options.resetLabel,
            windowTitle: options.windowTitle,
            windowLevel: Boolean(options.toolbarHost)
        });
        toolbar.querySelector(".plot-dialog-window-title")?.remove();
        const reset = toolbar.querySelector<HTMLButtonElement>(
            ".plot-dialog-window-controls > button"
        );
        if (reset && options.reset) {
            reset.title = "Restore default chart settings and 100% zoom";
        }
        return toolbar;
    };

    if (!payload.conditions.length || !payload.configurations.length) {
        if (options.toolbarHost) {
            options.toolbarHost.replaceChildren(renderToolbar(null));
        }
        const empty = document.createElement("div");
        empty.textContent = payload.message || "Select an intermediate solution to preview its Fiss chart.";
        empty.style.display = "grid";
        empty.style.placeItems = "center";
        empty.style.height = "100%";
        empty.style.padding = "24px";
        empty.style.color = "#666";
        empty.style.textAlign = "center";
        host.appendChild(empty);
        return;
    }

    const conditionWidth = Math.max(150, ...payload.conditions.map((label) => label.length * 7 + 28));
    const columnWidth = 82;
    const left = 18;
    const top = 18;
    const titleHeight = 34;
    const headerHeight = 34;
    const rowHeight = 28;
    const legendHeight = payload.legend ? 76 : 18;
    const tableWidth = conditionWidth + payload.configurations.length * columnWidth;
    const width = Math.max(520, tableWidth + left * 2);
    const height = top * 2 + titleHeight + headerHeight
        + payload.conditions.length * rowHeight + 5 * rowHeight + legendHeight;
    const svg = svgElement("svg", {
        viewBox: `0 0 ${width} ${height}`,
        width,
        height,
        role: "img",
        "aria-label": payload.title || "Fiss configuration chart"
    });
    const chart = svgElement("g", {
        "font-family": "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    });
    const shell = document.createElement("div");
    const viewport = document.createElement("div");
    const stage = document.createElement("div");
    svg.style.display = "block";
    svg.style.color = "#000";
    svg.style.background = "#fff";
    shell.className = "plot-dialog-shell";
    viewport.className = "plot-dialog-viewport";
    stage.className = "plot-dialog-stage";
    svg.appendChild(chart);
    stage.appendChild(svg);
    viewport.appendChild(stage);
    if (options.toolbarHost) {
        shell.appendChild(viewport);
        options.toolbarHost.innerHTML = "";
        options.toolbarHost.appendChild(renderToolbar(svg));
    }
    else {
        shell.append(renderToolbar(svg), viewport);
    }
    host.appendChild(shell);

    let y = top;
    addText(chart, payload.title, left + tableWidth / 2, y + 18, {
        anchor: "middle",
        weight: 650,
        size: 15
    });
    y += titleHeight;
    addRule(chart, left, left + tableWidth, y, 1.2);
    addText(chart, "Condition", left + 8, y + 22, { weight: 600 });
    const centers = payload.configurations.map((_, index) => {
        return left + conditionWidth + columnWidth * (index + 0.5);
    });
    payload.configurations.forEach((label, index) => {
        const node = addText(chart, label, centers[index], y + 22, {
            anchor: "middle",
            weight: 600
        });
        const title = svgElement("title");
        title.textContent = payload.expressions[index] || label;
        node.appendChild(title);
    });
    y += headerHeight;
    addRule(chart, left, left + tableWidth, y);

    payload.conditions.forEach((condition, row) => {
        const cy = y + rowHeight / 2;
        addText(chart, condition, left + 8, cy + 4);
        centers.forEach((cx, column) => {
            const value = payload.values[row]?.[column];
            if (value === "0" || value === "1") {
                addSymbol(chart, cx, cy, value === "1", payload.roles[row]?.[column] === "core");
            }
        });
        y += rowHeight;
    });
    addRule(chart, left, left + tableWidth, y);

    const metrics: Array<[string, keyof QcaFissRenderPayload["fit"][number]]> = [
        ["Consistency", "consistency"],
        ["Raw coverage", "rawCoverage"],
        ["Unique coverage", "uniqueCoverage"]
    ];
    metrics.forEach(([label, key]) => {
        const cy = y + rowHeight / 2;
        addText(chart, label, left + 8, cy + 4);
        centers.forEach((cx, column) => {
            addText(chart, formatFit(payload.fit[column]?.[key] ?? null), cx, cy + 4, { anchor: "middle" });
        });
        y += rowHeight;
    });
    addRule(chart, left, left + tableWidth, y);

    [["Solution consistency", payload.solutionFit.consistency], ["Solution coverage", payload.solutionFit.coverage]]
        .forEach(([label, value]) => {
            const cy = y + rowHeight / 2;
            addText(chart, String(label), left + 8, cy + 4);
            addText(
                chart,
                formatFit(value as number | null),
                left + conditionWidth + (tableWidth - conditionWidth) / 2,
                cy + 4,
                { anchor: "middle" }
            );
            y += rowHeight;
        });
    addRule(chart, left, left + tableWidth, y, 1.2);

    if (payload.legend) {
        const labels = [
            ["Core present", true, true],
            ["Core absent", false, true],
            ["Peripheral present", true, false],
            ["Peripheral absent", false, false]
        ] as const;
        const legendWidth = Math.min(220, tableWidth / 2);
        const legendLeft = left + (tableWidth - legendWidth * 2) / 2;
        labels.forEach(([label, present, core], index) => {
            const column = index % 2;
            const row = Math.floor(index / 2);
            const cy = y + 22 + row * 24;
            const cx = legendLeft + column * legendWidth + 8;
            addSymbol(chart, cx, cy, present, core);
            addText(chart, label, cx + 18, cy + 4);
        });
        addText(chart, "Blank: unspecified; -: unavailable statistic", left + tableWidth / 2, y + 66, {
            anchor: "middle",
            size: 11
        });
    }
};

export const qcaFissRendererApi = { renderFissChart };
