import type {
    ProfileCustomJSApi
} from "dialogforge/shared/dialog-runtime/renderer/modules/profileCustomJSApi";


export interface DialogQcaRuntimeApi extends ProfileCustomJSApi {
    addError?: (elementName: string, message: string) => void;
    check?: (elementName: string) => void;
    clearContent?: (...elementNames: string[]) => void;
    clearError?: (elementName: string) => void;
    disable?: (elementName: string) => void;
    enable?: (elementName: string) => void;
    getSelected?: (elementName: string) => unknown;
    getValue?: (elementName: string) => unknown;
    hide?: (elementName: string) => void;
    isChecked?: (elementName: string) => boolean;
    listObjects?: (objectType: string) => unknown;
    setSelected?: (elementName: string, value: unknown) => void;
    setValue?: (elementName: string, value: unknown) => void;
    show?: (elementName: string) => void;
    uncheck?: (elementName: string) => void;
    updateSyntax?: (command: string) => void;
}


export const asPayloadRecord = function(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    return value as Record<string, unknown>;
};


export const asString = function(value: unknown): string {
    return String(value == null ? "" : value).trim();
};


export const firstSelected = function(value: unknown): string {
    return Array.isArray(value) ? asString(value[0]) : asString(value);
};
