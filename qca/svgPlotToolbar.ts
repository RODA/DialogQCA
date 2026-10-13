export interface SvgPlotToolbarOptions {
    svg: SVGSVGElement | null;
    title: string;
    formats?: string[];
    exportPdf?: () => Promise<{ data: Uint8Array }>;
    reset?: () => void;
    resetLabel?: string;
    windowTitle?: string;
    windowLevel?: boolean;
    zoom: number;
    setZoom: (zoom: number) => void;
    signal: AbortSignal;
}


export const createSvgPlotToolbar = function(options: SvgPlotToolbarOptions): HTMLElement {
    const current = window as Window & {
        DialogForgeSvgPlotToolbar?: {
            createToolbar: (options: SvgPlotToolbarOptions) => HTMLElement;
        };
    };
    if (!current.DialogForgeSvgPlotToolbar) {
        throw new Error("The shared SVG plot toolbar is unavailable.");
    }
    return current.DialogForgeSvgPlotToolbar.createToolbar(options);
};


export const getPlotToolbarHost = function(plot: HTMLElement): HTMLElement | undefined {
    const root = plot.closest(".dialog-root");
    if (!(root instanceof HTMLElement)) {
        return undefined;
    }
    const existing = root.querySelector<HTMLElement>(
        ":scope > .plot-dialog-window-toolbar-host"
    );
    if (existing) {
        return existing;
    }
    const toolbar = document.createElement("div");
    toolbar.className = "plot-dialog-window-toolbar-host";
    root.appendChild(toolbar);
    return toolbar;
};


export const getPlotResetButton = function(node: unknown): HTMLElement | null {
    if (!(node instanceof HTMLElement)) {
        return null;
    }
    return node.matches("button, .smart-button")
        ? node
        : node.querySelector<HTMLElement>("button, .smart-button");
};
