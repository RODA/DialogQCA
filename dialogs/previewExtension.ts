import type {
    ProductDialogPreviewExtension
} from "dialogforge/shared/dialog-runtime/productDialogPreviewExtension";
import {
    qcaDialogRuntimeAdapterApi
} from "../qca/qcaDialogRuntimeAdapter";
import {
    qcaVennRendererApi
} from "../qca/vennRenderer";
import {
    qcaXYPlotRendererApi
} from "../qca/xyPlotRenderer";
import {
    qcaFissRendererApi
} from "../qca/fissRenderer";
import type { QcaFissRenderPayload } from "../qca/qcaFissDialog";


const isVennPayload = function(payload: unknown): boolean {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return false;
    }

    const record = payload as Record<string, unknown>;

    return Array.isArray(record.conditions)
        && Array.isArray(record.ids)
        && Array.isArray(record.out)
        && Array.isArray(record.cases);
};


const isXYPlotPayload = function(payload: unknown): boolean {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return false;
    }

    const record = payload as Record<string, unknown>;

    return Array.isArray(record.points)
        && typeof record.xAxisLabel !== "undefined"
        && typeof record.yAxisLabel !== "undefined";
};


const isFissPayload = function(payload: unknown): payload is QcaFissRenderPayload {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return false;
    }

    const record = payload as Record<string, unknown>;

    return record.kind === "fiss"
        && Array.isArray(record.conditions)
        && Array.isArray(record.configurations);
};


export const productDialogPreviewExtension: ProductDialogPreviewExtension = {
    applyExternalCallResult: function(context) {
        qcaDialogRuntimeAdapterApi.applyQcaExternalCallResultToControls(
            context.model,
            context.name,
            context.parameters,
            context.value
        );
    },
    renderPlotPayload: function(host, payload) {
        if (isFissPayload(payload)) {
            qcaFissRendererApi.renderFissChart(host, payload);
            return true;
        }

        if (isVennPayload(payload)) {
            qcaVennRendererApi.renderVennDiagram(
                host,
                payload as Parameters<typeof qcaVennRendererApi.renderVennDiagram>[1]
            );
            return true;
        }

        if (isXYPlotPayload(payload)) {
            qcaXYPlotRendererApi.renderXYPlot(
                host,
                payload as Parameters<typeof qcaXYPlotRendererApi.renderXYPlot>[1]
            );
            return true;
        }

        return false;
    }
};
