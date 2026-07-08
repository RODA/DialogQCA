export interface QcaXYPlotRenderPoint {
    x: number;
    y: number;
    label?: string;
}


export interface QcaXYPlotRenderPayload {
    points?: QcaXYPlotRenderPoint[];
    xAxisLabel?: string;
    yAxisLabel?: string;
    fitLabels?: string[];
    showGuides?: boolean;
    showCases?: boolean;
    fillPoints?: boolean;
    jitterPoints?: boolean;
    caseLabelRotation?: number;
}


const SVG_NS = "http://www.w3.org/2000/svg";


const asNumber = function(value: unknown): number {
    const out = Number(value);
    return Number.isFinite(out) ? out : 0;
};


const asText = function(value: unknown): string {
    return String(value ?? "").trim();
};


const createSvgElement = function<K extends keyof SVGElementTagNameMap>(
    name: K,
    attrs: Record<string, string | number> = {}
): SVGElementTagNameMap[K] {
    const element = document.createElementNS(SVG_NS, name);

    Object.keys(attrs).forEach((key) => {
        element.setAttribute(key, String(attrs[key]));
    });

    return element;
};


const readPoints = function(payload: QcaXYPlotRenderPayload): QcaXYPlotRenderPoint[] {
    return Array.isArray(payload.points)
        ? payload.points.map((point) => {
            return {
                x: asNumber(point.x),
                y: asNumber(point.y),
                label: asText(point.label)
            };
        }).filter((point) => {
            return Number.isFinite(point.x) && Number.isFinite(point.y);
        })
        : [];
};


const pointRange = function(points: QcaXYPlotRenderPoint[], key: "x" | "y"): { min: number; max: number } {
    const values = points.map((point) => {
        return point[key];
    });
    const min = Math.min(0, ...values);
    const max = Math.max(1, ...values);

    if (min === max) {
        return {
            min: min - 0.5,
            max: max + 0.5
        };
    }

    return { min, max };
};


const scaleValue = function(value: number, min: number, max: number, start: number, end: number): number {
    return start + ((value - min) / (max - min)) * (end - start);
};


const stableJitterOffset = function(point: QcaXYPlotRenderPoint, index: number, axis: "x" | "y"): number {
    const text = point.label || String(index);
    let hash = axis === "x" ? 17 : 37;

    for (let offset = 0; offset < text.length; offset += 1) {
        hash = (hash * 31 + text.charCodeAt(offset)) % 9973;
    }

    return (hash / 9972) * 10 - 5;
};


export const renderXYPlot = function(host: HTMLElement, payload: QcaXYPlotRenderPayload): void {
    const width = Math.max(280, host.clientWidth || 300);
    const height = Math.max(190, host.clientHeight || 220);
    const padding = {
        left: 44,
        right: 18,
        top: 18,
        bottom: 42
    };
    const points = readPoints(payload);
    const xRange = pointRange(points, "x");
    const yRange = pointRange(points, "y");
    const svg = createSvgElement("svg", {
        viewBox: "0 0 " + width + " " + height,
        width: "100%",
        height: "100%"
    });
    const plotLeft = padding.left;
    const plotRight = width - padding.right;
    const plotTop = padding.top;
    const plotBottom = height - padding.bottom;

    host.textContent = "";
    svg.style.display = "block";
    host.appendChild(svg);

    svg.appendChild(createSvgElement("rect", {
        x: plotLeft,
        y: plotTop,
        width: plotRight - plotLeft,
        height: plotBottom - plotTop,
        fill: "#ffffff",
        stroke: "#cbd1da"
    }));

    svg.appendChild(createSvgElement("line", {
        x1: plotLeft,
        y1: plotBottom,
        x2: plotRight,
        y2: plotBottom,
        stroke: "#3b4450",
        "stroke-width": 1
    }));

    svg.appendChild(createSvgElement("line", {
        x1: plotLeft,
        y1: plotTop,
        x2: plotLeft,
        y2: plotBottom,
        stroke: "#3b4450",
        "stroke-width": 1
    }));

    svg.appendChild(createSvgElement("line", {
        x1: scaleValue(0, xRange.min, xRange.max, plotLeft, plotRight),
        y1: scaleValue(0, yRange.min, yRange.max, plotBottom, plotTop),
        x2: scaleValue(1, xRange.min, xRange.max, plotLeft, plotRight),
        y2: scaleValue(1, yRange.min, yRange.max, plotBottom, plotTop),
        stroke: "#a0a0a0",
        "stroke-width": 1
    }));

    if (payload.showGuides !== false) {
        svg.appendChild(createSvgElement("line", {
            x1: plotLeft,
            y1: scaleValue(0.5, yRange.min, yRange.max, plotBottom, plotTop),
            x2: plotRight,
            y2: scaleValue(0.5, yRange.min, yRange.max, plotBottom, plotTop),
            stroke: "#a0a0a0",
            "stroke-width": 1,
            "stroke-dasharray": "8 6"
        }));

        svg.appendChild(createSvgElement("line", {
            x1: scaleValue(0.5, xRange.min, xRange.max, plotLeft, plotRight),
            y1: plotTop,
            x2: scaleValue(0.5, xRange.min, xRange.max, plotLeft, plotRight),
            y2: plotBottom,
            stroke: "#a0a0a0",
            "stroke-width": 1,
            "stroke-dasharray": "8 6"
        }));
    }

    points.forEach((point, index) => {
        const jitterX = payload.jitterPoints === true ? stableJitterOffset(point, index, "x") : 0;
        const jitterY = payload.jitterPoints === true ? stableJitterOffset(point, index, "y") : 0;
        const x = scaleValue(point.x, xRange.min, xRange.max, plotLeft, plotRight) + jitterX;
        const y = scaleValue(point.y, yRange.min, yRange.max, plotBottom, plotTop) + jitterY;
        const marker = createSvgElement("circle", {
            cx: x,
            cy: y,
            r: 4,
            fill: payload.fillPoints === false ? "#ffffff" : "#1c8ac9",
            stroke: "#0d4e78",
            "stroke-width": 1
        });

        if (payload.showCases !== true && point.label) {
            const label = createSvgElement("title");
            label.textContent = point.label;
            marker.appendChild(label);
        }

        svg.appendChild(marker);

        if (payload.showCases === true && point.label) {
            const rotation = asNumber(payload.caseLabelRotation);
            const group = createSvgElement("g", {
                transform: rotation ? "rotate(" + (-rotation) + " " + x + " " + y + ")" : ""
            });
            const placeLeft = x > plotLeft + (plotRight - plotLeft) - 70;
            const label = createSvgElement("text", {
                x: placeLeft ? x - 7 : x + 7,
                y: y + 4,
                "text-anchor": placeLeft ? "end" : "start",
                "font-size": 11,
                "font-weight": 700,
                fill: "#1f2933",
                "fill-opacity": 0.75
            });

            label.textContent = point.label;
            group.appendChild(label);
            svg.appendChild(group);
        }
    });

    const xLabel = createSvgElement("text", {
        x: (plotLeft + plotRight) / 2,
        y: height - 10,
        "text-anchor": "middle",
        "font-size": 12,
        fill: "#3b4450"
    });
    xLabel.textContent = asText(payload.xAxisLabel) || "X";
    svg.appendChild(xLabel);

    const yLabel = createSvgElement("text", {
        x: 14,
        y: (plotTop + plotBottom) / 2,
        "text-anchor": "middle",
        "font-size": 12,
        fill: "#3b4450",
        transform: "rotate(-90 14 " + ((plotTop + plotBottom) / 2) + ")"
    });
    yLabel.textContent = asText(payload.yAxisLabel) || "Y";
    svg.appendChild(yLabel);

    (payload.fitLabels || []).slice(0, 3).forEach((label, index) => {
        const text = createSvgElement("text", {
            x: plotLeft + 8,
            y: plotTop + 16 + index * 16,
            "font-size": 11,
            fill: "#3b4450"
        });

        text.textContent = asText(label);
        svg.appendChild(text);
    });
};


export const qcaXYPlotRendererApi = {
    renderXYPlot
};
