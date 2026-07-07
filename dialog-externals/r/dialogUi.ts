import type {
    ProfileCustomJSContext
} from "dialogforge/shared/dialog-runtime/renderer/modules/profileCustomJSApi";
import type {
    DialogQcaRuntimeApi
} from "./runtimeApi";
import {
    asPayloadRecord,
    asString
} from "./runtimeApi";


export const createQcaDialogUi = function(
    api: DialogQcaRuntimeApi,
    context: ProfileCustomJSContext
) {
    const setVisible = function(elementName: string, visible: boolean): void {
        if (!elementName) {
            return;
        }

        if (visible) {
            api.show?.(elementName);
        } else {
            api.hide?.(elementName);
        }
    };

    const setEnabled = function(elementName: string, enabled: boolean): void {
        if (!elementName) {
            return;
        }

        if (enabled) {
            api.enable?.(elementName);
        } else {
            api.disable?.(elementName);
        }
    };

    const setChecked = function(elementName: string, checked: boolean): void {
        if (!elementName) {
            return;
        }

        if (checked) {
            api.check?.(elementName);
        } else {
            api.uncheck?.(elementName);
        }
    };

    const setLabelWeight = function(
        elementName: string,
        weight = "700"
    ): void {
        try {
            const node = api.getElementNode?.(elementName);
            const element = node as unknown as {
                element?: {
                    txt?: {
                        node?: unknown;
                    };
                };
                relayout?: () => void;
            };
            const textNode = element?.element?.txt?.node;

            if (textNode instanceof HTMLElement || textNode instanceof SVGElement) {
                textNode.style.fontWeight = String(weight);
            }

            element?.relayout?.();
        } catch {
            // A label can disappear while an asynchronous preview is resolving.
        }
    };

    const getDialogKey = function(prefix: string, payload: unknown): string {
        const source = asPayloadRecord(payload);

        return asString(source.dialogKey)
            || asString(source.stateKey)
            || `${prefix}:${asString(context.objects?.dialogID) || "default"}`;
    };

    return {
        getDialogKey,
        setChecked,
        setEnabled,
        setLabelWeight,
        setVisible
    };
};
