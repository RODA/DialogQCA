import type {
    PlotViewport,
    PlotViewportInteraction
} from "@dialogforge/core";


export interface QcaXYPlotRenderPoint {
    x: number;
    y: number;
    label?: string;
    jitterX?: number;
    jitterY?: number;
}


export interface QcaXYPlotRenderPayload {
    points?: QcaXYPlotRenderPoint[];
    xAxisLabel?: string;
    yAxisLabel?: string;
    fitLabels?: string[];
    showGuides?: boolean;
    showCases?: boolean;
    showAxisLabels?: boolean;
    showFitLabels?: boolean;
    fillPoints?: boolean;
    jitterPoints?: boolean;
    caseLabelRotation?: number;
    toolbarLabels?: {
        guides?: string;
        fill?: string;
        jitter?: string;
        labels?: string;
        rotation?: string;
    };
    onGuidesChange?: (active: boolean) => void;
    onFillChange?: (active: boolean) => void;
    onJitterChange?: (active: boolean) => void;
    onLabelsChange?: (active: boolean) => void;
    onLabelRotationChange?: (value: number) => void;
    dataKey?: string;
    loading?: boolean;
}


interface XYPlotLayout {
    width: number;
    height: number;
    squareLeft: number;
    squareTop: number;
    squareRight: number;
    squareBottom: number;
    plotLeft: number;
    plotTop: number;
    plotRight: number;
    plotBottom: number;
    plotSize: number;
}


interface XYPlotScreenPoint {
    x: number;
    y: number;
    label: string;
}


interface XYPlotController {
    host: HTMLElement;
    root: HTMLDivElement;
    toolbar: HTMLDivElement;
    canvas: HTMLCanvasElement;
    tooltip: HTMLDivElement;
    status: HTMLSpanElement;
    guidesButton: HTMLButtonElement;
    fillButton: HTMLButtonElement;
    jitterButton: HTMLButtonElement;
    labelsButton: HTMLButtonElement;
    rotationSlider: HTMLDivElement;
    rotationSliderHandle: HTMLSpanElement;
    rotationDragging: boolean;
    saveMenu: HTMLDivElement;
    savePopup: HTMLDivElement;
    saveFormat: HTMLSelectElement;
    saveWidth: HTMLInputElement;
    saveHeight: HTMLInputElement;
    zoomMenu: HTMLDivElement;
    zoomPopup: HTMLDivElement;
    zoomLabel: HTMLSpanElement;
    zoomItems: HTMLButtonElement[];
    payload: QcaXYPlotRenderPayload;
    points: QcaXYPlotRenderPoint[];
    dataKey: string;
    viewport: PlotViewport;
    layout: XYPlotLayout;
    screenPoints: XYPlotScreenPoint[];
    interaction: PlotViewportInteraction | null;
    resizeObserver: ResizeObserver | null;
}


interface DialogForgeWindow extends Window {
    dialogForge?: {
        savePlot?: (input: {
            data: Uint8Array;
            fileName: string;
            format: "png" | "jpeg" | "svg";
        }) => Promise<{
            status?: string;
            message?: string;
        }>;
    };
    showSaveFilePicker?: (options: unknown) => Promise<{
        createWritable: () => Promise<{
            write: (data: ArrayBuffer) => Promise<void>;
            close: () => Promise<void>;
        }>;
    }>;
}


const SVG_NS = "http://www.w3.org/2000/svg";
const HOME_VIEWPORT: PlotViewport = {
    xMin: 0,
    xMax: 1,
    yMin: 0,
    yMax: 1
};
const ZOOM_LEVELS = [1, 1.5, 2, 2.5, 3];
const controllers = new WeakMap<HTMLElement, XYPlotController>();


const asNumber = function(value: unknown): number {
    const out = Number(value);
    return Number.isFinite(out) ? out : 0;
};


const asText = function(value: unknown): string {
    return String(value ?? "").trim();
};


const clamp = function(value: number, minimum: number, maximum: number): number {
    return Math.max(minimum, Math.min(maximum, value));
};


const copyViewport = function(viewport: PlotViewport): PlotViewport {
    return { ...viewport };
};


const sharedPlotViewport = function() {
    const api = window.DialogForgePlotViewport;

    if (!api) {
        throw new Error("DialogForge plot viewport interactions are unavailable.");
    }

    return api;
};


const readPoints = function(payload: QcaXYPlotRenderPayload): QcaXYPlotRenderPoint[] {
    if (!Array.isArray(payload.points)) {
        return [];
    }

    return payload.points.map((point) => {
        return {
            x: Number(point.x),
            y: Number(point.y),
            label: asText(point.label),
            jitterX: asNumber(point.jitterX),
            jitterY: asNumber(point.jitterY)
        };
    }).filter((point) => {
        return Number.isFinite(point.x) && Number.isFinite(point.y);
    });
};


const stableJitterOffset = function(
    point: QcaXYPlotRenderPoint,
    index: number,
    axis: "x" | "y"
): number {
    const supplied = axis === "x" ? point.jitterX : point.jitterY;

    if (Number.isFinite(supplied) && supplied !== 0) {
        return Number(supplied);
    }

    const text = point.label || String(index);
    let hash = axis === "x" ? 17 : 37;

    for (let offset = 0; offset < text.length; offset += 1) {
        hash = (hash * 31 + text.charCodeAt(offset)) % 9973;
    }

    return (hash / 9972) * 10 - 5;
};


const dataKeyForPayload = function(
    payload: QcaXYPlotRenderPayload,
    points: QcaXYPlotRenderPoint[]
): string {
    if (payload.dataKey) {
        return payload.dataKey;
    }

    const first = points[0];
    const last = points[points.length - 1];

    return [
        asText(payload.xAxisLabel),
        asText(payload.yAxisLabel),
        String(points.length),
        first ? `${first.x},${first.y},${first.label || ""}` : "",
        last ? `${last.x},${last.y},${last.label || ""}` : ""
    ].join("::");
};


const createElement = function<K extends keyof HTMLElementTagNameMap>(
    name: K,
    styles: Partial<CSSStyleDeclaration> = {}
): HTMLElementTagNameMap[K] {
    const element = document.createElement(name);

    Object.assign(element.style, styles);

    return element;
};


const createSvgElement = function<K extends keyof SVGElementTagNameMap>(
    name: K,
    attributes: Record<string, string | number> = {}
): SVGElementTagNameMap[K] {
    const element = document.createElementNS(SVG_NS, name);

    Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, String(value));
    });

    return element;
};


const styleToolbarButton = function(button: HTMLButtonElement, iconOnly = false): void {
    Object.assign(button.style, {
        minWidth: iconOnly ? "26px" : "32px",
        width: iconOnly ? "26px" : "auto",
        height: "26px",
        padding: iconOnly ? "0" : "0 8px",
        border: "1px solid #d0d0d0",
        borderRadius: "6px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffffff",
        color: "#383838",
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
        fontSize: "11px",
        fontWeight: "700",
        lineHeight: "1",
        cursor: "pointer",
        boxSizing: "border-box",
        flex: "0 0 auto",
        whiteSpace: "nowrap"
    });

    button.addEventListener("mouseenter", () => {
        button.style.background = button.getAttribute("aria-pressed") === "true"
            ? "#cfe1cf"
            : "#f0f0f0";
    });
    button.addEventListener("mouseleave", () => {
        button.style.background = button.getAttribute("aria-pressed") === "true"
            ? "#dce9dc"
            : "#ffffff";
    });
};


const createToolbarToggle = function(
    host: HTMLElement,
    label: string
): HTMLButtonElement {
    const button = createElement("button");

    button.type = "button";
    button.textContent = label;
    button.setAttribute("aria-pressed", "false");
    styleToolbarButton(button);
    host.appendChild(button);

    return button;
};


const setToolbarToggleState = function(
    button: HTMLButtonElement,
    active: boolean
): void {
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.style.background = active ? "#dce9dc" : "#ffffff";
    button.style.borderColor = active ? "#6b986b" : "#d0d0d0";
    button.style.color = active ? "#214b21" : "#383838";
};


const createCopyIcon = function(): HTMLSpanElement {
    const icon = createElement("span", {
        position: "relative",
        display: "inline-block",
        width: "18px",
        height: "18px"
    });
    const rear = createElement("span", {
        position: "absolute",
        width: "10px",
        height: "10px",
        border: "1.3px solid currentColor",
        borderRadius: "2.5px",
        boxSizing: "border-box",
        top: "1.5px",
        left: "5px"
    });
    const front = createElement("span", {
        position: "absolute",
        width: "10px",
        height: "10px",
        border: "1.3px solid currentColor",
        borderRadius: "2.5px",
        boxSizing: "border-box",
        top: "4.5px",
        left: "1.5px"
    });

    icon.append(rear, front);

    return icon;
};


const createSaveIcon = function(): SVGSVGElement {
    const svg = createSvgElement("svg", {
        width: 16,
        height: 16,
        viewBox: "0 0 16 16",
        "aria-hidden": "true"
    });

    svg.appendChild(createSvgElement("rect", {
        x: 1,
        y: 1,
        width: 14,
        height: 14,
        rx: 0.7,
        fill: "none",
        stroke: "currentColor"
    }));
    svg.appendChild(createSvgElement("path", {
        d: "M3.5 1v3.46c0 .3.24.54.54.54h7.92c.3 0 .54-.24.54-.54V1M5.04 9c-.3 0-.54.24-.54.54V15h7V9.54c0-.3-.24-.54-.54-.54Z",
        fill: "none",
        stroke: "currentColor",
        "stroke-linecap": "round"
    }));

    return svg;
};


const createFitIcon = function(): SVGSVGElement {
    const svg = createSvgElement("svg", {
        width: 18,
        height: 18,
        viewBox: "0 0 16 16",
        "aria-hidden": "true"
    });

    svg.appendChild(createSvgElement("rect", {
        x: 4,
        y: 4,
        width: 8,
        height: 8,
        fill: "none",
        stroke: "currentColor"
    }));
    [
        "M8 .5 6.5 2.5h3Z",
        "M8 15.5 9.5 13.5h-3Z",
        "M.5 8l2 1.5v-3Z",
        "M15.5 8l-2-1.5v3Z"
    ].forEach((path) => {
        svg.appendChild(createSvgElement("path", {
            d: path,
            fill: "currentColor"
        }));
    });

    return svg;
};


const stylePopup = function(popup: HTMLElement): void {
    Object.assign(popup.style, {
        position: "absolute",
        top: "36px",
        right: "0",
        padding: "8px",
        border: "1px solid rgba(0, 0, 0, 0.14)",
        borderRadius: "14px",
        background: "rgba(255, 255, 255, 0.98)",
        boxShadow: "0 12px 28px rgba(0, 0, 0, 0.18)",
        display: "none",
        zIndex: "40",
        boxSizing: "border-box"
    });
};


const setPopupOpen = function(popup: HTMLElement, button: HTMLElement, open: boolean): void {
    popup.style.display = open ? "block" : "none";
    button.setAttribute("aria-expanded", open ? "true" : "false");
};


const setStatus = function(controller: XYPlotController, message: string): void {
    controller.status.textContent = message;

    if (message) {
        window.setTimeout(() => {
            if (controller.status.textContent === message) {
                controller.status.textContent = "";
            }
        }, 2200);
    }
};


const calculateLayout = function(
    width: number,
    height: number,
    showAxisLabels: boolean,
    topGutter = 0
): XYPlotLayout {
    const leftGutter = showAxisLabels ? 54 : 45;
    const rightGutter = showAxisLabels ? 10 : 5;
    const bottomGutter = showAxisLabels ? 44 : 40;
    const squareSize = Math.max(120, Math.min(
        width - leftGutter - rightGutter,
        height - topGutter - bottomGutter
    ));
    const squareLeft = leftGutter;
    const squareTop = topGutter;
    const squareRight = squareLeft + squareSize;
    const squareBottom = squareTop + squareSize;
    const inset = 8;

    return {
        width,
        height,
        squareLeft,
        squareTop,
        squareRight,
        squareBottom,
        plotLeft: squareLeft + inset,
        plotTop: squareTop + inset,
        plotRight: squareRight - inset,
        plotBottom: squareBottom - inset,
        plotSize: squareSize - inset * 2
    };
};


const scaleX = function(value: number, layout: XYPlotLayout, viewport: PlotViewport): number {
    return layout.plotLeft
        + ((value - viewport.xMin) / (viewport.xMax - viewport.xMin)) * layout.plotSize;
};


const scaleY = function(value: number, layout: XYPlotLayout, viewport: PlotViewport): number {
    return layout.plotBottom
        - ((value - viewport.yMin) / (viewport.yMax - viewport.yMin)) * layout.plotSize;
};


const tickStep = function(minimum: number, maximum: number, targetCount = 10): number {
    const raw = Math.abs(maximum - minimum) / Math.max(1, targetCount);
    const magnitude = 10 ** Math.floor(Math.log10(raw || 1));
    const normalized = raw / magnitude;
    const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;

    return factor * magnitude;
};


const tickValues = function(minimum: number, maximum: number): number[] {
    const step = tickStep(minimum, maximum);
    const first = Math.ceil((minimum - step * 1e-8) / step) * step;
    const values: number[] = [];

    for (let value = first; value <= maximum + step * 1e-8; value += step) {
        values.push(Math.round(value * 1e12) / 1e12);
    }

    return values;
};


const formatTick = function(value: number, step: number): string {
    if (Math.abs(value) < 1e-12) {
        return "0";
    }

    if (Math.abs(value - 1) < 1e-12) {
        return "1";
    }

    const decimals = Math.max(0, Math.min(4, Math.ceil(-Math.log10(step))));

    return value.toFixed(decimals).replace(/0+$/, "").replace(/\.$/, "");
};


const lineIntersection = function(viewport: PlotViewport): { start: number; end: number } | null {
    const start = Math.max(viewport.xMin, viewport.yMin);
    const end = Math.min(viewport.xMax, viewport.yMax);

    return start <= end ? { start, end } : null;
};


const drawFrame = function(
    context: CanvasRenderingContext2D,
    controller: XYPlotController
): void {
    const { layout, viewport, payload } = controller;
    const xStep = tickStep(viewport.xMin, viewport.xMax);
    const yStep = tickStep(viewport.yMin, viewport.yMax);

    context.save();
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, layout.width, layout.height);
    context.strokeStyle = "#000000";
    context.lineWidth = 1;
    context.strokeRect(
        layout.squareLeft + 0.5,
        layout.squareTop + 0.5,
        layout.squareRight - layout.squareLeft,
        layout.squareBottom - layout.squareTop
    );

    const equality = lineIntersection(viewport);

    if (equality) {
        context.beginPath();
        context.moveTo(scaleX(equality.start, layout, viewport), scaleY(equality.start, layout, viewport));
        context.lineTo(scaleX(equality.end, layout, viewport), scaleY(equality.end, layout, viewport));
        context.strokeStyle = "#a0a0a0";
        context.lineWidth = 1.2;
        context.stroke();
    }

    if (payload.showGuides !== false) {
        context.save();
        context.strokeStyle = "#a0a0a0";
        context.lineWidth = 1;
        context.setLineDash([8, 6]);

        if (viewport.yMin <= 0.5 && viewport.yMax >= 0.5) {
            const y = scaleY(0.5, layout, viewport);
            context.beginPath();
            context.moveTo(layout.squareLeft, y);
            context.lineTo(layout.squareRight, y);
            context.stroke();
        }

        if (viewport.xMin <= 0.5 && viewport.xMax >= 0.5) {
            const x = scaleX(0.5, layout, viewport);
            context.beginPath();
            context.moveTo(x, layout.squareTop);
            context.lineTo(x, layout.squareBottom);
            context.stroke();
        }

        context.restore();
    }

    context.fillStyle = "#000000";
    context.strokeStyle = "#000000";
    context.font = "12px Inter, ui-sans-serif, system-ui, sans-serif";
    context.textBaseline = "middle";

    tickValues(viewport.xMin, viewport.xMax).forEach((value) => {
        const x = scaleX(value, layout, viewport);

        context.beginPath();
        context.moveTo(x, layout.squareBottom);
        context.lineTo(x, layout.squareBottom + 7);
        context.stroke();
        context.textAlign = "center";
        context.fillText(formatTick(value, xStep), x, layout.squareBottom + 18);
    });

    tickValues(viewport.yMin, viewport.yMax).forEach((value) => {
        const y = scaleY(value, layout, viewport);

        context.beginPath();
        context.moveTo(layout.squareLeft - 7, y);
        context.lineTo(layout.squareLeft, y);
        context.stroke();
        context.textAlign = "right";
        context.fillText(formatTick(value, yStep), layout.squareLeft - 11, y);
    });

    if (payload.showAxisLabels !== false) {
        context.font = "700 12px Inter, ui-sans-serif, system-ui, sans-serif";
        context.textAlign = "center";
        context.fillText(
            asText(payload.xAxisLabel) || "X",
            (layout.squareLeft + layout.squareRight) / 2,
            layout.squareBottom + 36
        );
        context.save();
        context.translate(10, (layout.squareTop + layout.squareBottom) / 2);
        context.rotate(-Math.PI / 2);
        context.fillText(asText(payload.yAxisLabel) || "Y", 0, 0);
        context.restore();
    }

    context.restore();
};


const drawPoints = function(
    context: CanvasRenderingContext2D,
    controller: XYPlotController
): void {
    const { layout, viewport, payload, points } = controller;
    // Thousands of labels are intentionally expensive. Suppress them while
    // the selection rectangle is moving so pointer feedback stays fluid, then
    // restore them for the final zoomed frame.
    const showLabels = payload.showCases === true
        && !controller.interaction?.isSelecting()
        && !controller.interaction?.isPanning();
    const useJitter = payload.jitterPoints === true;
    const rotation = -asNumber(payload.caseLabelRotation) * Math.PI / 180;

    controller.screenPoints = [];
    context.save();
    context.beginPath();
    context.rect(
        layout.squareLeft,
        layout.squareTop,
        layout.squareRight - layout.squareLeft,
        layout.squareBottom - layout.squareTop
    );
    context.clip();
    context.beginPath();

    points.forEach((point, index) => {
        if (
            point.x < viewport.xMin
            || point.x > viewport.xMax
            || point.y < viewport.yMin
            || point.y > viewport.yMax
        ) {
            return;
        }

        const x = scaleX(point.x, layout, viewport)
            + (useJitter ? stableJitterOffset(point, index, "x") : 0);
        const y = scaleY(point.y, layout, viewport)
            + (useJitter ? stableJitterOffset(point, index, "y") : 0);

        context.moveTo(x + 3, y);
        context.arc(x, y, 3, 0, Math.PI * 2);
        controller.screenPoints.push({
            x,
            y,
            label: asText(point.label)
        });
    });

    context.fillStyle = payload.fillPoints === false ? "#ffffff" : "#707070";
    context.strokeStyle = "#707070";
    context.lineWidth = 1;
    context.fill();
    context.stroke();

    if (showLabels) {
        context.fillStyle = "rgba(0, 0, 0, 0.7)";
        context.font = "700 12px Inter, ui-sans-serif, system-ui, sans-serif";
        context.textBaseline = "middle";

        controller.screenPoints.forEach((point) => {
            if (!point.label) {
                return;
            }

            context.save();
            context.translate(point.x, point.y);
            context.rotate(rotation);
            const placeLeft = point.x > layout.plotRight - 100;

            context.textAlign = placeLeft ? "right" : "left";
            context.fillText(point.label, placeLeft ? -8 : 8, 0);
            context.restore();
        });
    }

    context.restore();
};


const drawFitLabels = function(
    context: CanvasRenderingContext2D,
    controller: XYPlotController
): void {
    const labels = (controller.payload.fitLabels || []).slice(0, 3);

    if (!labels.length) {
        return;
    }

    context.save();
    context.fillStyle = "#3b4450";
    context.font = "11px Inter, ui-sans-serif, system-ui, sans-serif";
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    labels.forEach((label, index) => {
        context.fillText(
            asText(label),
            controller.layout.plotLeft + 8,
            controller.layout.plotTop + 16 + index * 16
        );
    });
    context.restore();
};


const drawExportFitLabels = function(
    context: CanvasRenderingContext2D,
    controller: XYPlotController
): void {
    const labels = (controller.payload.fitLabels || []).slice(0, 3);

    if (!labels.length) {
        return;
    }

    const segmentWidth = (
        controller.layout.squareRight - controller.layout.squareLeft
    ) / labels.length;

    context.save();
    context.fillStyle = "#000000";
    context.font = "12px Inter, ui-sans-serif, system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    labels.forEach((label, index) => {
        context.fillText(
            asText(label),
            controller.layout.squareLeft + segmentWidth * (index + 0.5),
            controller.layout.squareTop / 2
        );
    });
    context.restore();
};


const drawDragSelection = function(
    context: CanvasRenderingContext2D,
    controller: XYPlotController
): void {
    const selection = controller.interaction?.getSelection();

    if (!selection) {
        return;
    }

    context.save();
    context.fillStyle = "rgba(31, 79, 184, 0.12)";
    context.strokeStyle = "#1f4fb8";
    context.lineWidth = 1;
    context.setLineDash([5, 3]);
    context.fillRect(
        selection.left,
        selection.top,
        selection.width,
        selection.height
    );
    context.strokeRect(
        selection.left + 0.5,
        selection.top + 0.5,
        selection.width,
        selection.height
    );
    context.restore();
};


const drawPlot = function(controller: XYPlotController): void {
    const width = Math.max(280, controller.host.clientWidth || 550);
    const height = Math.max(190, controller.host.clientHeight || 540);
    const deviceScale = Math.max(1, window.devicePixelRatio || 1);

    controller.layout = calculateLayout(
        width,
        height,
        controller.payload.showAxisLabels !== false
    );
    controller.canvas.style.width = `${width}px`;
    controller.canvas.style.height = `${height}px`;
    controller.canvas.dataset.viewportXMin = String(controller.viewport.xMin);
    controller.canvas.dataset.viewportXMax = String(controller.viewport.xMax);
    controller.canvas.dataset.viewportYMin = String(controller.viewport.yMin);
    controller.canvas.dataset.viewportYMax = String(controller.viewport.yMax);
    controller.canvas.dataset.pointCount = String(controller.points.length);
    controller.canvas.dataset.loading = String(controller.payload.loading === true);
    controller.canvas.dataset.dataKey = controller.dataKey;

    const pixelWidth = Math.round(width * deviceScale);
    const pixelHeight = Math.round(height * deviceScale);

    if (controller.canvas.width !== pixelWidth || controller.canvas.height !== pixelHeight) {
        controller.canvas.width = pixelWidth;
        controller.canvas.height = pixelHeight;
    }

    const context = controller.canvas.getContext("2d");

    if (!context) {
        return;
    }

    context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
    context.clearRect(0, 0, width, height);
    drawFrame(context, controller);

    if (controller.payload.loading === true) {
        context.save();
        context.fillStyle = "#666666";
        context.font = "14px Inter, ui-sans-serif, system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(
            "Loading...",
            (controller.layout.squareLeft + controller.layout.squareRight) / 2,
            (controller.layout.squareTop + controller.layout.squareBottom) / 2
        );
        context.restore();
    } else {
        drawPoints(context, controller);
        if (controller.payload.showFitLabels !== false) {
            drawFitLabels(context, controller);
        }
    }

    drawDragSelection(context, controller);
    controller.saveWidth.value = String(Math.round(width));
    controller.saveHeight.value = String(Math.round(height));
    controller.guidesButton.textContent = controller.payload.toolbarLabels?.guides
        || "Guides";
    controller.fillButton.textContent = controller.payload.toolbarLabels?.fill
        || "Fill";
    controller.jitterButton.textContent = controller.payload.toolbarLabels?.jitter
        || "Jitter";
    controller.labelsButton.textContent = controller.payload.toolbarLabels?.labels
        || "Labels";
    setToolbarToggleState(
        controller.guidesButton,
        controller.payload.showGuides !== false
    );
    setToolbarToggleState(
        controller.fillButton,
        controller.payload.fillPoints !== false
    );
    setToolbarToggleState(
        controller.jitterButton,
        controller.payload.jitterPoints === true
    );
    setToolbarToggleState(
        controller.labelsButton,
        controller.payload.showCases === true
    );
    controller.rotationSlider.style.display = controller.payload.showCases === true
        ? "flex"
        : "none";
    const rotationValue = clamp(
        asNumber(controller.payload.caseLabelRotation) / 45,
        0,
        1
    );
    const rotationLabel = controller.payload.toolbarLabels?.rotation
        || "Rotate case labels";

    controller.rotationSlider.title = rotationLabel;
    controller.rotationSlider.setAttribute("aria-label", rotationLabel);
    controller.rotationSlider.setAttribute("aria-valuenow", String(rotationValue));
    controller.rotationSliderHandle.style.left = `${rotationValue * 100}%`;
};


const viewportZoom = function(viewport: PlotViewport): number {
    const widestRange = Math.max(
        viewport.xMax - viewport.xMin,
        viewport.yMax - viewport.yMin
    );

    return widestRange > 0 ? 1 / widestRange : 1;
};


const viewportIsPreset = function(viewport: PlotViewport, zoom: number): boolean {
    const half = 0.5 / zoom;
    const epsilon = 1e-8;

    return Math.abs(viewport.xMin - (0.5 - half)) < epsilon
        && Math.abs(viewport.xMax - (0.5 + half)) < epsilon
        && Math.abs(viewport.yMin - (0.5 - half)) < epsilon
        && Math.abs(viewport.yMax - (0.5 + half)) < epsilon;
};


const updateZoomToolbar = function(controller: XYPlotController): void {
    const zoom = viewportZoom(controller.viewport);

    controller.zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
    controller.zoomItems.forEach((item) => {
        const value = Number(item.dataset.zoom || "1");
        const selected = viewportIsPreset(controller.viewport, value);
        const check = item.firstElementChild as HTMLElement | null;

        item.setAttribute("aria-checked", selected ? "true" : "false");
        if (check) {
            check.style.visibility = selected ? "visible" : "hidden";
        }
    });
};


const applyZoomPreset = function(controller: XYPlotController, zoom: number): void {
    const normalized = Math.max(1, zoom);

    controller.interaction?.cancel();
    controller.viewport = sharedPlotViewport().centeredViewport(
        normalized,
        HOME_VIEWPORT
    );
    updateZoomToolbar(controller);
    drawPlot(controller);
};


const canvasPoint = function(controller: XYPlotController, event: PointerEvent | MouseEvent) {
    const rect = controller.canvas.getBoundingClientRect();

    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
};


const hideTooltip = function(controller: XYPlotController): void {
    controller.tooltip.style.display = "none";
};


const updateTooltip = function(controller: XYPlotController, event: PointerEvent): void {
    if (
        controller.payload.showCases === true
        || controller.interaction?.isSelecting()
        || controller.interaction?.isPanning()
        || controller.interaction?.isShiftPressed()
    ) {
        hideTooltip(controller);
        return;
    }

    const point = canvasPoint(controller, event);
    let closest: XYPlotScreenPoint | null = null;
    let closestDistance = 64;

    controller.screenPoints.forEach((candidate) => {
        if (!candidate.label) {
            return;
        }

        const dx = point.x - candidate.x;
        const dy = point.y - candidate.y;
        const distance = dx * dx + dy * dy;

        if (distance < closestDistance) {
            closest = candidate;
            closestDistance = distance;
        }
    });

    if (!closest) {
        hideTooltip(controller);
        return;
    }

    controller.tooltip.textContent = (closest as XYPlotScreenPoint).label;
    controller.tooltip.style.display = "block";
    const tooltipWidth = controller.tooltip.offsetWidth || 80;
    const tooltipHeight = controller.tooltip.offsetHeight || 20;
    const left = clamp(point.x + 10, 8, controller.layout.width - tooltipWidth - 8);
    let top = point.y - tooltipHeight - 10;

    if (top < 8) {
        top = point.y + 12;
    }

    controller.tooltip.style.left = `${left}px`;
    controller.tooltip.style.top = `${Math.max(8, top)}px`;
};


const canvasBlob = function(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
            } else {
                reject(new Error("Unable to export the XY plot."));
            }
        }, type, quality);
    });
};


const renderExportCanvas = function(
    controller: XYPlotController,
    width: number,
    height: number
): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    const fitLabels = (controller.payload.fitLabels || []).slice(0, 3);
    const exportPayload: QcaXYPlotRenderPayload = {
        ...controller.payload,
        showAxisLabels: true,
        showFitLabels: false
    };
    const exportController: XYPlotController = {
        ...controller,
        canvas,
        payload: exportPayload,
        layout: calculateLayout(width, height, true, fitLabels.length ? 30 : 0),
        screenPoints: [],
        interaction: null
    };

    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (context) {
        drawFrame(context, exportController);
        drawPoints(context, exportController);
        drawExportFitLabels(context, exportController);
    }

    return canvas;
};


const appendSvgText = function(
    parent: SVGElement,
    value: string,
    attributes: Record<string, string | number>
): SVGTextElement {
    const text = createSvgElement("text", attributes);

    text.textContent = value;
    parent.appendChild(text);

    return text;
};


const renderExportSvg = function(
    controller: XYPlotController,
    width: number,
    height: number
): string {
    const fitLabels = (controller.payload.fitLabels || []).slice(0, 3);
    const payload: QcaXYPlotRenderPayload = {
        ...controller.payload,
        showAxisLabels: true,
        showFitLabels: false
    };
    const layout = calculateLayout(width, height, true, fitLabels.length ? 30 : 0);
    const viewport = controller.viewport;
    const svg = createSvgElement("svg", {
        xmlns: SVG_NS,
        width,
        height,
        viewBox: `0 0 ${width} ${height}`
    });
    const clipId = "dialogqca-xy-plot-clip";
    const defs = createSvgElement("defs");
    const clipPath = createSvgElement("clipPath", { id: clipId });

    clipPath.appendChild(createSvgElement("rect", {
        x: layout.squareLeft,
        y: layout.squareTop,
        width: layout.squareRight - layout.squareLeft,
        height: layout.squareBottom - layout.squareTop
    }));
    defs.appendChild(clipPath);
    svg.appendChild(defs);
    svg.appendChild(createSvgElement("rect", {
        x: 0,
        y: 0,
        width,
        height,
        fill: "#ffffff"
    }));

    if (fitLabels.length) {
        const segmentWidth = (layout.squareRight - layout.squareLeft) / fitLabels.length;

        fitLabels.forEach((label, index) => {
            appendSvgText(svg, asText(label), {
                x: layout.squareLeft + segmentWidth * (index + 0.5),
                y: layout.squareTop / 2,
                fill: "#000000",
                "font-family": "Inter, ui-sans-serif, system-ui, sans-serif",
                "font-size": 12,
                "font-weight": 400,
                "text-anchor": "middle",
                "dominant-baseline": "middle"
            });
        });
    }

    const equality = lineIntersection(viewport);

    if (equality) {
        svg.appendChild(createSvgElement("line", {
            x1: scaleX(equality.start, layout, viewport),
            y1: scaleY(equality.start, layout, viewport),
            x2: scaleX(equality.end, layout, viewport),
            y2: scaleY(equality.end, layout, viewport),
            stroke: "#a0a0a0",
            "stroke-width": 1.2
        }));
    }

    if (payload.showGuides !== false) {
        if (viewport.yMin <= 0.5 && viewport.yMax >= 0.5) {
            const y = scaleY(0.5, layout, viewport);

            svg.appendChild(createSvgElement("line", {
                x1: layout.squareLeft,
                y1: y,
                x2: layout.squareRight,
                y2: y,
                stroke: "#a0a0a0",
                "stroke-width": 1,
                "stroke-dasharray": "8 6"
            }));
        }
        if (viewport.xMin <= 0.5 && viewport.xMax >= 0.5) {
            const x = scaleX(0.5, layout, viewport);

            svg.appendChild(createSvgElement("line", {
                x1: x,
                y1: layout.squareTop,
                x2: x,
                y2: layout.squareBottom,
                stroke: "#a0a0a0",
                "stroke-width": 1,
                "stroke-dasharray": "8 6"
            }));
        }
    }

    const pointGroup = createSvgElement("g", {
        "clip-path": `url(#${clipId})`
    });
    const useJitter = payload.jitterPoints === true;
    const showLabels = payload.showCases === true;
    const labelRotation = -asNumber(payload.caseLabelRotation);

    controller.points.forEach((point, index) => {
        if (
            point.x < viewport.xMin
            || point.x > viewport.xMax
            || point.y < viewport.yMin
            || point.y > viewport.yMax
        ) {
            return;
        }

        const x = scaleX(point.x, layout, viewport)
            + (useJitter ? stableJitterOffset(point, index, "x") : 0);
        const y = scaleY(point.y, layout, viewport)
            + (useJitter ? stableJitterOffset(point, index, "y") : 0);

        pointGroup.appendChild(createSvgElement("circle", {
            cx: x,
            cy: y,
            r: 3,
            fill: payload.fillPoints === false ? "#ffffff" : "#707070",
            stroke: "#707070",
            "stroke-width": 1
        }));

        if (showLabels && point.label) {
            const placeLeft = x > layout.plotRight - 100;

            appendSvgText(pointGroup, asText(point.label), {
                x: x + (placeLeft ? -8 : 8),
                y,
                fill: "rgba(0, 0, 0, 0.7)",
                "font-family": "Inter, ui-sans-serif, system-ui, sans-serif",
                "font-size": 12,
                "font-weight": 700,
                "text-anchor": placeLeft ? "end" : "start",
                "dominant-baseline": "middle",
                transform: `rotate(${labelRotation} ${x} ${y})`
            });
        }
    });
    svg.appendChild(pointGroup);
    svg.appendChild(createSvgElement("rect", {
        x: layout.squareLeft + 0.5,
        y: layout.squareTop + 0.5,
        width: layout.squareRight - layout.squareLeft,
        height: layout.squareBottom - layout.squareTop,
        fill: "none",
        stroke: "#000000",
        "stroke-width": 1
    }));

    const tickTextAttributes = {
        fill: "#000000",
        "font-family": "Inter, ui-sans-serif, system-ui, sans-serif",
        "font-size": 12,
        "dominant-baseline": "middle"
    };
    const xStep = tickStep(viewport.xMin, viewport.xMax);

    tickValues(viewport.xMin, viewport.xMax).forEach((value) => {
        const x = scaleX(value, layout, viewport);

        svg.appendChild(createSvgElement("line", {
            x1: x,
            y1: layout.squareBottom,
            x2: x,
            y2: layout.squareBottom + 7,
            stroke: "#000000"
        }));
        appendSvgText(svg, formatTick(value, xStep), {
            ...tickTextAttributes,
            x,
            y: layout.squareBottom + 18,
            "text-anchor": "middle"
        });
    });

    const yStep = tickStep(viewport.yMin, viewport.yMax);

    tickValues(viewport.yMin, viewport.yMax).forEach((value) => {
        const y = scaleY(value, layout, viewport);

        svg.appendChild(createSvgElement("line", {
            x1: layout.squareLeft - 7,
            y1: y,
            x2: layout.squareLeft,
            y2: y,
            stroke: "#000000"
        }));
        appendSvgText(svg, formatTick(value, yStep), {
            ...tickTextAttributes,
            x: layout.squareLeft - 11,
            y,
            "text-anchor": "end"
        });
    });

    const axisTextAttributes = {
        fill: "#000000",
        "font-family": "Inter, ui-sans-serif, system-ui, sans-serif",
        "font-size": 12,
        "font-weight": 700,
        "text-anchor": "middle",
        "dominant-baseline": "middle"
    };

    appendSvgText(svg, asText(payload.xAxisLabel) || "X", {
        ...axisTextAttributes,
        x: (layout.squareLeft + layout.squareRight) / 2,
        y: layout.squareBottom + 36
    });
    const yAxisCenter = (layout.squareTop + layout.squareBottom) / 2;

    appendSvgText(svg, asText(payload.yAxisLabel) || "Y", {
        ...axisTextAttributes,
        x: 10,
        y: yAxisCenter,
        transform: `rotate(-90 10 ${yAxisCenter})`
    });

    return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(svg)}`;
};


const copyPlot = async function(controller: XYPlotController): Promise<void> {
    try {
        const blob = await canvasBlob(
            renderExportCanvas(controller, controller.layout.width, controller.layout.height),
            "image/png"
        );

        if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
            throw new Error("Image clipboard access is unavailable.");
        }

        await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob })
        ]);
        setStatus(controller, "Copied");
    } catch (error) {
        console.error("Unable to copy the XY plot", error);
        setStatus(controller, "Copy failed");
    }
};


const savePlot = async function(controller: XYPlotController): Promise<void> {
    const selectedFormat = controller.saveFormat.value;
    const format = selectedFormat === "jpeg" || selectedFormat === "svg"
        ? selectedFormat
        : "png";
    const type = format === "jpeg"
        ? "image/jpeg"
        : format === "svg" ? "image/svg+xml" : "image/png";
    const width = clamp(Math.round(Number(controller.saveWidth.value) || controller.layout.width), 160, 10000);
    const height = clamp(Math.round(Number(controller.saveHeight.value) || controller.layout.height), 160, 10000);

    try {
        const blob = format === "svg"
            ? new Blob([renderExportSvg(controller, width, height)], {
                type: "image/svg+xml;charset=utf-8"
            })
            : await canvasBlob(
                renderExportCanvas(controller, width, height),
                type,
                format === "jpeg" ? 0.92 : undefined
            );
        const windowRef = window as DialogForgeWindow;
        const extension = format === "jpeg" ? "jpg" : format;

        if (windowRef.dialogForge?.savePlot) {
            const result = await windowRef.dialogForge.savePlot({
                data: new Uint8Array(await blob.arrayBuffer()),
                fileName: `DialogQCA-XY-plot.${extension}`,
                format
            });

            if (result?.status === "canceled") {
                return;
            }
            if (result?.status !== "saved") {
                throw new Error(result?.message || "Unable to save the XY plot.");
            }
        } else if (windowRef.showSaveFilePicker) {
            const handle = await windowRef.showSaveFilePicker({
                suggestedName: `DialogQCA-XY-plot.${extension}`,
                types: [{
                    description: format === "jpeg"
                        ? "JPEG Image"
                        : format === "svg" ? "SVG Image" : "PNG Image",
                    accept: { [type]: [`.${extension}`] }
                }]
            });
            const writable = await handle.createWritable();

            try {
                await writable.write(await blob.arrayBuffer());
            } finally {
                await writable.close();
            }
        } else {
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");

            link.href = url;
            link.download = `DialogQCA-XY-plot.${extension}`;
            link.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        }

        setStatus(controller, "Saved");
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
            return;
        }

        console.error("Unable to save the XY plot", error);
        setStatus(controller, "Save failed");
    }
};


const createSaveMenu = function(toolbar: HTMLElement) {
    const menu = createElement("div", {
        position: "relative",
        display: "inline-flex"
    });
    const button = createElement("button");

    button.type = "button";
    button.title = "Save plot";
    button.setAttribute("aria-label", "Save plot");
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-expanded", "false");
    styleToolbarButton(button, true);
    button.appendChild(createSaveIcon());

    const popup = createElement("div");
    stylePopup(popup);
    Object.assign(popup.style, {
        width: "208px",
        padding: "10px"
    });
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-label", "Save plot options");

    const grid = createElement("div", {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "8px 10px",
        alignItems: "end"
    });
    const fieldStyle: Partial<CSSStyleDeclaration> = {
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        minWidth: "0"
    };
    const formatField = createElement("label", fieldStyle);
    const formatLabel = createElement("span");
    const format = createElement("select", {
        width: "100%",
        height: "24px",
        border: "1px solid #d0d0d0",
        borderRadius: "6px",
        background: "#ffffff",
        fontSize: "11px"
    });

    formatLabel.textContent = "Format";
    formatLabel.style.font = "700 11px Inter, sans-serif";
    formatField.style.gridColumn = "1 / -1";
    [
        ["png", "PNG"],
        ["jpeg", "JPEG"],
        ["svg", "SVG"]
    ].forEach(([value, label]) => {
        const option = document.createElement("option");

        option.value = value;
        option.textContent = label;
        format.appendChild(option);
    });
    formatField.append(formatLabel, format);

    const createSizeField = function(labelText: string) {
        const field = createElement("label", fieldStyle);
        const label = createElement("span");
        const input = createElement("input", {
            width: "100%",
            height: "24px",
            padding: "0 8px",
            border: "1px solid #d0d0d0",
            borderRadius: "6px",
            boxSizing: "border-box",
            fontSize: "11px"
        });

        label.textContent = labelText;
        label.style.font = "700 11px Inter, sans-serif";
        input.type = "number";
        input.min = "160";
        input.max = "10000";
        field.append(label, input);

        return { field, input };
    };
    const widthField = createSizeField("Width");
    const heightField = createSizeField("Height");
    const actions = createElement("div", {
        gridColumn: "1 / -1",
        display: "flex",
        justifyContent: "flex-end",
        gap: "6px",
        paddingTop: "4px"
    });
    const cancel = createElement("button");
    const save = createElement("button");

    cancel.type = "button";
    cancel.textContent = "Cancel";
    save.type = "button";
    save.textContent = "Save...";
    styleToolbarButton(cancel);
    styleToolbarButton(save);
    actions.append(cancel, save);
    grid.append(formatField, widthField.field, heightField.field, actions);
    popup.appendChild(grid);
    menu.append(button, popup);
    toolbar.appendChild(menu);

    return {
        menu,
        button,
        popup,
        format,
        width: widthField.input,
        height: heightField.input,
        cancel,
        save
    };
};


const createZoomMenu = function(toolbar: HTMLElement) {
    const menu = createElement("div", {
        position: "relative",
        display: "inline-flex"
    });
    const button = createElement("button");

    button.type = "button";
    button.title = "Set the plot zoom";
    button.setAttribute("aria-label", "Set the plot zoom");
    button.setAttribute("aria-haspopup", "menu");
    button.setAttribute("aria-expanded", "false");
    styleToolbarButton(button);
    Object.assign(button.style, {
        padding: "0 5px",
        gap: "4px",
        fontWeight: "400"
    });
    button.appendChild(createFitIcon());
    const label = createElement("span");

    label.textContent = "100%";
    button.appendChild(label);
    const arrow = createElement("span", {
        width: "0",
        height: "0",
        borderLeft: "4px solid transparent",
        borderRight: "4px solid transparent",
        borderTop: "5px solid #5a5a5a",
        marginLeft: "1px"
    });

    button.appendChild(arrow);

    const popup = createElement("div");
    stylePopup(popup);
    Object.assign(popup.style, {
        minWidth: "154px",
        padding: "8px 0",
        borderRadius: "22px"
    });
    popup.setAttribute("role", "menu");
    popup.setAttribute("aria-label", "Set the plot zoom");
    const items = ZOOM_LEVELS.map((zoom) => {
        const item = createElement("button");
        const check = createElement("span", {
            width: "16px",
            visibility: zoom === 1 ? "visible" : "hidden"
        });
        const text = createElement("span", {
            flex: "1 1 auto",
            textAlign: "left",
            paddingLeft: "6px"
        });

        item.type = "button";
        item.dataset.zoom = String(zoom);
        item.setAttribute("role", "menuitemradio");
        item.setAttribute("aria-checked", zoom === 1 ? "true" : "false");
        Object.assign(item.style, {
            width: "100%",
            height: "32px",
            padding: "0 14px",
            border: "0",
            background: "transparent",
            color: "#2f2f2f",
            display: "flex",
            alignItems: "center",
            fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
            fontSize: "11px",
            cursor: "pointer",
            boxSizing: "border-box"
        });
        check.textContent = "✓";
        text.textContent = `${Math.round(zoom * 100)}%`;
        item.append(check, text);

        return item;
    });
    const hint = createElement("div", {
        borderTop: "1px solid #e5e5e5",
        marginTop: "4px",
        padding: "7px 14px 2px",
        color: "#666666",
        font: "11px/1.3 Inter, ui-sans-serif, system-ui, sans-serif",
        whiteSpace: "nowrap"
    });

    hint.textContent = "Drag to zoom · Shift-drag to pan";
    items.forEach((item) => popup.appendChild(item));
    popup.appendChild(hint);
    menu.append(button, popup);
    toolbar.appendChild(menu);

    return { menu, button, popup, label, items };
};


const createController = function(host: HTMLElement): XYPlotController {
    host.replaceChildren();
    Object.assign(host.style, {
        position: "relative",
        overflow: "visible"
    });

    const root = createElement("div", {
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "visible"
    });
    const toolbar = createElement("div", {
        position: "absolute",
        top: "0",
        left: "0",
        right: "0",
        height: "34px",
        padding: "0 12px",
        borderBottom: "1px solid #d7d7d7",
        background: "#f8f8f8",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: "6px",
        zIndex: "20",
        boxSizing: "border-box"
    });
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", "XY plot toolbar");

    const plotOptions = createElement("div", {
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        marginRight: "auto",
        minWidth: "0"
    });
    const guidesButton = createToolbarToggle(plotOptions, "Guides");
    const fillButton = createToolbarToggle(plotOptions, "Fill");
    const jitterButton = createToolbarToggle(plotOptions, "Jitter");
    const labelsButton = createToolbarToggle(plotOptions, "Labels");
    const rotationSlider = createElement("div", {
        display: "none",
        position: "relative",
        alignItems: "center",
        width: "80px",
        minWidth: "80px",
        height: "18px",
        margin: "0 2px",
        overflow: "visible",
        cursor: "pointer",
        touchAction: "none"
    });
    const rotationTrack = createElement("span", {
        position: "absolute",
        left: "0",
        right: "0",
        top: "50%",
        height: "1px",
        background: "#000000",
        transform: "translateY(-0.5px)",
        pointerEvents: "none"
    });
    const rotationSliderHandle = createElement("span", {
        position: "absolute",
        left: "0",
        top: "50%",
        width: "12px",
        height: "12px",
        borderRadius: "50%",
        background: "#558855",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none"
    });

    rotationSlider.tabIndex = 0;
    rotationSlider.setAttribute("role", "slider");
    rotationSlider.setAttribute("aria-valuemin", "0");
    rotationSlider.setAttribute("aria-valuemax", "1");
    rotationSlider.setAttribute("aria-valuenow", "0");
    rotationSlider.title = "Rotate case labels";
    rotationSlider.setAttribute("aria-label", "Rotate case labels");
    rotationSlider.append(rotationTrack, rotationSliderHandle);
    plotOptions.appendChild(rotationSlider);
    toolbar.appendChild(plotOptions);

    const status = createElement("span", {
        color: "#6f6f6f",
        font: "500 11px Inter, sans-serif",
        marginRight: "2px"
    });
    status.setAttribute("aria-live", "polite");
    toolbar.appendChild(status);

    const copyButton = createElement("button");

    copyButton.type = "button";
    copyButton.title = "Copy plot to clipboard";
    copyButton.setAttribute("aria-label", "Copy plot to clipboard");
    styleToolbarButton(copyButton, true);
    copyButton.appendChild(createCopyIcon());
    toolbar.appendChild(copyButton);

    const save = createSaveMenu(toolbar);
    const zoom = createZoomMenu(toolbar);
    const canvas = createElement("canvas", {
        display: "block",
        cursor: "crosshair",
        touchAction: "none"
    });
    canvas.setAttribute(
        "aria-label",
        "XY plot. Drag a rectangle to zoom. Hold Shift and drag to pan."
    );
    const tooltip = createElement("div", {
        position: "absolute",
        pointerEvents: "none",
        display: "none",
        padding: "3px 6px",
        border: "1px solid #9a9a9a",
        borderRadius: "4px",
        background: "rgba(255,255,255,0.96)",
        color: "#222222",
        fontSize: "11px",
        lineHeight: "1.2",
        boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
        zIndex: "12"
    });

    root.append(canvas, tooltip);
    host.appendChild(root);

    const paper = document.getElementById?.("paper");

    if (paper) {
        paper.appendChild(toolbar);
    } else {
        root.appendChild(toolbar);
    }

    const controller: XYPlotController = {
        host,
        root,
        toolbar,
        canvas,
        tooltip,
        status,
        guidesButton,
        fillButton,
        jitterButton,
        labelsButton,
        rotationSlider,
        rotationSliderHandle,
        saveMenu: save.menu,
        savePopup: save.popup,
        saveFormat: save.format,
        saveWidth: save.width,
        saveHeight: save.height,
        zoomMenu: zoom.menu,
        zoomPopup: zoom.popup,
        zoomLabel: zoom.label,
        zoomItems: zoom.items,
        payload: {},
        points: [],
        dataKey: "",
        viewport: copyViewport(HOME_VIEWPORT),
        layout: calculateLayout(550, 540, true),
        screenPoints: [],
        interaction: null,
        rotationDragging: false,
        resizeObserver: null
    };
    const viewportApi = sharedPlotViewport();
    let panStartViewport = copyViewport(controller.viewport);

    const togglePlotOption = function(
        key: "showGuides" | "fillPoints" | "jitterPoints" | "showCases",
        callback: "onGuidesChange" | "onFillChange" | "onJitterChange" | "onLabelsChange"
    ): void {
        const current = key === "showGuides" || key === "fillPoints"
            ? controller.payload[key] !== false
            : controller.payload[key] === true;
        const next = !current;

        controller.payload[key] = next;
        const notify = controller.payload[callback];

        if (notify) {
            notify(next);
        } else {
            drawPlot(controller);
        }
    };

    guidesButton.addEventListener("click", () => {
        togglePlotOption("showGuides", "onGuidesChange");
    });
    fillButton.addEventListener("click", () => {
        togglePlotOption("fillPoints", "onFillChange");
    });
    jitterButton.addEventListener("click", () => {
        togglePlotOption("jitterPoints", "onJitterChange");
    });
    labelsButton.addEventListener("click", () => {
        togglePlotOption("showCases", "onLabelsChange");
    });
    const setRotation = function(value: number, commit: boolean): void {
        const normalized = clamp(value, 0, 1);

        controller.payload.caseLabelRotation = normalized * 45;
        const notify = controller.payload.onLabelRotationChange;

        if (commit && notify) {
            notify(normalized);
        } else {
            drawPlot(controller);
        }
    };
    const setRotationFromPointer = function(event: PointerEvent, commit: boolean): void {
        const bounds = rotationSlider.getBoundingClientRect();

        setRotation((event.clientX - bounds.left) / bounds.width, commit);
    };

    rotationSlider.addEventListener("pointerdown", (event) => {
        controller.rotationDragging = true;
        rotationSlider.setPointerCapture?.(event.pointerId);
        setRotationFromPointer(event, false);
        event.preventDefault();
    });
    rotationSlider.addEventListener("pointermove", (event) => {
        if (controller.rotationDragging) {
            setRotationFromPointer(event, false);
        }
    });
    rotationSlider.addEventListener("pointerup", (event) => {
        if (!controller.rotationDragging) {
            return;
        }

        controller.rotationDragging = false;
        setRotationFromPointer(event, true);
        rotationSlider.releasePointerCapture?.(event.pointerId);
    });
    rotationSlider.addEventListener("pointercancel", () => {
        controller.rotationDragging = false;
        drawPlot(controller);
    });
    rotationSlider.addEventListener("keydown", (event) => {
        const current = clamp(
            asNumber(controller.payload.caseLabelRotation) / 45,
            0,
            1
        );
        let next: number | null = null;

        if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
            next = current - 0.01;
        } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
            next = current + 0.01;
        } else if (event.key === "Home") {
            next = 0;
        } else if (event.key === "End") {
            next = 1;
        }

        if (next !== null) {
            event.preventDefault();
            setRotation(next, true);
        }
    });

    copyButton.addEventListener("click", () => {
        void copyPlot(controller);
    });
    save.button.addEventListener("click", () => {
        setPopupOpen(controller.zoomPopup, zoom.button, false);
        setPopupOpen(
            save.popup,
            save.button,
            save.popup.style.display !== "block"
        );
    });
    save.cancel.addEventListener("click", () => {
        setPopupOpen(save.popup, save.button, false);
    });
    save.save.addEventListener("click", () => {
        void savePlot(controller).finally(() => {
            setPopupOpen(save.popup, save.button, false);
        });
    });
    zoom.button.addEventListener("click", () => {
        setPopupOpen(controller.savePopup, save.button, false);
        setPopupOpen(
            zoom.popup,
            zoom.button,
            zoom.popup.style.display !== "block"
        );
    });
    zoom.items.forEach((item) => {
        item.addEventListener("mouseenter", () => {
            item.style.background = "rgba(0, 0, 0, 0.04)";
        });
        item.addEventListener("mouseleave", () => {
            item.style.background = "transparent";
        });
        item.addEventListener("click", () => {
            applyZoomPreset(controller, Number(item.dataset.zoom || "1"));
            setPopupOpen(zoom.popup, zoom.button, false);
        });
    });
    controller.interaction = viewportApi.createInteraction({
        element: canvas,
        getBounds: () => ({
            left: controller.layout.plotLeft,
            top: controller.layout.plotTop,
            right: controller.layout.plotRight,
            bottom: controller.layout.plotBottom
        }),
        onGestureStart: (): void => {
            hideTooltip(controller);
            setPopupOpen(controller.savePopup, save.button, false);
            setPopupOpen(controller.zoomPopup, zoom.button, false);
        },
        onSelectionChange: (): void => {
            drawPlot(controller);
        },
        onRectangleComplete: (selection): void => {
            if (selection) {
                controller.viewport = viewportApi.viewportFromSelection(
                    controller.viewport,
                    selection.normalized
                );
                updateZoomToolbar(controller);
            }
            drawPlot(controller);
        },
        onPanStart: (): void => {
            panStartViewport = copyViewport(controller.viewport);
        },
        onPan: (movement): void => {
            controller.viewport = viewportApi.pannedViewport(
                panStartViewport,
                movement.normalizedX,
                movement.normalizedY,
                HOME_VIEWPORT
            );
            updateZoomToolbar(controller);
            drawPlot(controller);
        },
        onHover: (input): void => {
            updateTooltip(controller, input.event);
        },
        onLeave: (): void => {
            hideTooltip(controller);
        },
        onGestureStateChange: (): void => {
            if (controller.interaction?.isShiftPressed()) {
                hideTooltip(controller);
            }
            drawPlot(controller);
        }
    });
    document.addEventListener("pointerdown", (event) => {
        const target = event.target;

        if (!(target instanceof Node)) {
            return;
        }

        if (!save.menu.contains(target)) {
            setPopupOpen(controller.savePopup, save.button, false);
        }
        if (!zoom.menu.contains(target)) {
            setPopupOpen(controller.zoomPopup, zoom.button, false);
        }
    });
    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") {
            return;
        }

        setPopupOpen(controller.savePopup, save.button, false);
        setPopupOpen(controller.zoomPopup, zoom.button, false);
    });

    if (typeof ResizeObserver === "function") {
        controller.resizeObserver = new ResizeObserver(() => {
            window.requestAnimationFrame(() => drawPlot(controller));
        });
        controller.resizeObserver.observe(host);
    }

    return controller;
};


export const renderXYPlot = function(host: HTMLElement, payload: QcaXYPlotRenderPayload): void {
    const controller = controllers.get(host) || createController(host);
    const points = readPoints(payload);
    const dataKey = dataKeyForPayload(payload, points);

    if (!controllers.has(host)) {
        controllers.set(host, controller);
    }

    if (controller.dataKey && controller.dataKey !== dataKey) {
        controller.interaction?.cancel();
        controller.viewport = copyViewport(HOME_VIEWPORT);
    }

    controller.payload = payload;
    controller.points = points;
    controller.dataKey = dataKey;
    updateZoomToolbar(controller);
    drawPlot(controller);
};


export const qcaXYPlotRendererApi = {
    renderXYPlot
};
