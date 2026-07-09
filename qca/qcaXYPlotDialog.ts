export interface QcaXYPlotDialogRequest {
    selectedDataset?: unknown;
    dataset?: unknown;
    selectedX?: unknown;
    xVariable?: unknown;
    xVariableName?: unknown;
    selectedY?: unknown;
    yVariable?: unknown;
    yVariableName?: unknown;
    plotData?: unknown;
    necessity?: unknown;
    negateX?: unknown;
    negateY?: unknown;
    showParametersOfFit?: unknown;
    showGuides?: unknown;
    showCases?: unknown;
    fillPoints?: unknown;
    jitterPoints?: unknown;
    caseLabelRotation?: unknown;
}


export interface QcaXYPlotPoint {
    x: number;
    y: number;
    label: string;
}


export interface QcaXYPlotDialogState {
    selectedDataset: string;
    selectedX: string;
    selectedY: string;
    xAxisLabel: string;
    yAxisLabel: string;
    points: QcaXYPlotPoint[];
    fitLabels: string[];
    showGuides: boolean;
    showCases: boolean;
    fillPoints: boolean;
    jitterPoints: boolean;
    caseLabelRotation: number;
}


const asText = function(value: unknown): string {
    return String(value ?? "").trim();
};


const asBoolean = function(value: unknown): boolean {
    return value === true || value === "true" || value === 1 || value === "1";
};


const asRotation = function(value: unknown): number {
    const raw = Number(value);
    const steps = Number.isFinite(raw) ? Math.round(raw) : 0;

    return steps * 45;
};


const flipCalibratedValue = function(value: number): number {
    return Math.round((1 - value) * 1000000000000) / 1000000000000;
};


const objectValues = function(value: unknown): unknown[] {
    if (Array.isArray(value)) {
        return value;
    }

    if (value && typeof value === "object") {
        return Object.values(value);
    }

    return [];
};


const numberValues = function(value: unknown): number[] {
    return objectValues(value).map((entry) => {
        return Number(entry);
    });
};


const textValues = function(value: unknown): string[] {
    return objectValues(value).map((entry) => {
        return asText(entry);
    });
};


const readPlotData = function(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
};


export const buildQcaXYPlotPoints = function(plotData: unknown): QcaXYPlotPoint[] {
    const data = readPlotData(plotData);
    const xValues = numberValues(data.x);
    const yValues = numberValues(data.y);
    const labels = textValues(data.labels);
    const count = Math.min(xValues.length, yValues.length, labels.length || Math.min(xValues.length, yValues.length));
    const out: QcaXYPlotPoint[] = [];

    for (let index = 0; index < count; index += 1) {
        const x = xValues[index];
        const y = yValues[index];
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            continue;
        }

        out.push({
            x,
            y,
            label: labels[index] || ""
        });
    }

    return out;
};


export const buildQcaXYPlotFitLabels = function(request: QcaXYPlotDialogRequest): string[] {
    if (!asBoolean(request.showParametersOfFit)) {
        return [];
    }

    const data = readPlotData(request.plotData);
    const bucket = asBoolean(request.necessity) ? objectValues(data.necessity) : objectValues(data.sufficiency);
    const rowIndex = (asBoolean(request.negateX) ? 1 : 0) + (asBoolean(request.negateY) ? 2 : 0);
    const row = objectValues(bucket[rowIndex]);

    if (row.length < 3) {
        return [];
    }

    return [
        ("Inclusion: " + asText(row[0])).trim(),
        ("Coverage: " + asText(row[1])).trim(),
        ((asBoolean(request.necessity) ? "Relevance: " : "PRI: ") + asText(row[2])).trim()
    ];
};


const transformQcaXYPlotPoints = function(
    points: QcaXYPlotPoint[],
    request: QcaXYPlotDialogRequest
): QcaXYPlotPoint[] {
    const negateX = asBoolean(request.negateX);
    const negateY = asBoolean(request.negateY);

    return points.map((point) => {
        return {
            x: negateX ? flipCalibratedValue(point.x) : point.x,
            y: negateY ? flipCalibratedValue(point.y) : point.y,
            label: point.label
        };
    });
};


export const createQcaXYPlotDialogState = function(request: QcaXYPlotDialogRequest): QcaXYPlotDialogState {
    const selectedDataset = asText(request.selectedDataset ?? request.dataset);
    const selectedX = asText(request.selectedX ?? request.xVariable ?? request.xVariableName);
    const selectedY = asText(request.selectedY ?? request.yVariable ?? request.yVariableName);
    const points = buildQcaXYPlotPoints(request.plotData);

    return {
        selectedDataset,
        selectedX,
        selectedY,
        xAxisLabel: selectedX.toUpperCase(),
        yAxisLabel: selectedY.toUpperCase(),
        points: transformQcaXYPlotPoints(points, request),
        fitLabels: buildQcaXYPlotFitLabels(request),
        showGuides: request.showGuides === undefined ? true : asBoolean(request.showGuides),
        showCases: asBoolean(request.showCases),
        fillPoints: request.fillPoints === undefined ? true : asBoolean(request.fillPoints),
        jitterPoints: asBoolean(request.jitterPoints),
        caseLabelRotation: asRotation(request.caseLabelRotation)
    };
};
