declare namespace Monaco {
    namespace editor {
        type IStandaloneCodeEditor = any;
    }
    namespace languages {
        type LanguageConfiguration = any;
        type IMonarchLanguage = any;
    }
}

declare module "dialogforge/shared/dialog-runtime/productDialogPreviewExtension" {
    export interface ProductDialogPreviewExtension {
        applyExternalCallResult?(context: any): unknown;
        renderPlotPayload?(host: HTMLElement, payload: unknown): boolean;
    }
}

declare module "dialogforge/shared/dialog-runtime/renderer/modules/profileCustomJSApi" {
    export interface ProfileCustomJSApi {
        [key: string]: any;
    }
    export interface ProfileCustomJSContext {
        [key: string]: any;
    }
}

declare module "dialogforge/shared/runtime/provider-contract/runtimeProvider" {
    export interface RuntimeExtensionMethodResult {
        status: string;
        providerId?: string;
        method: string;
        value?: unknown;
        message?: string;
        executedAt?: string;
    }
    export interface RuntimeSessionManager {
        executeRuntimeMethod(request: unknown): Promise<any>;
    }
}

declare module "monaco-editor" {
    export = Monaco;
}
