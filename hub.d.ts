
interface LogHost {
    (...rest: any[]): void;
    error: (...rest: any) => void;
}

interface Unsubscribe {
    (): void;
}

// Note that our `request` options are intentionally leaner
// in scope than what is defined in the Fetch spec for now
interface SandboxRequestOptions {
    body?: string | Blob | BufferSource | FormData | ReadableStream | unknown;
    headers?: Record<string, string>;
    method?: "DELETE" | "GET" | "OPTIONS" | "PATCH" | "POST" | "PUT";
    params?: Record<string, unknown>;
    responseType?: "" | "arraybuffer" | "blob" | "document" | "json" | "text";
    timeout?: number;
    withCredentials?: boolean;
}

type SandboxRequestEvent = "progress" | "ok" | "error" | "complete" | "timeout" | "abort";

interface SandboxRequestProgress<T> {
    error?: Error,
    indeterminate?: boolean,
    loaded?: number,
    ok: boolean,
    progress?: number,
    response?: T,
    status?: number,
    total?: number,
}
interface SandboxRequestResponse<T> extends SandboxRequestProgress<T> {
}
interface SandboxRequest<T> extends Thenable<T> {
    readonly subscribe(fn: (ev: [SandboxRequestEvent, SandboxRequestProgress<T>]) => void): Unsubscribe;

    // Our API is a [[Thenable]] so it can be `await`-ed
    // a.k.a. PromiseLike<T>
    readonly then<TResult1 = SandboxRequestResponse<T>, TResult2 = never>(onfulfilled?: ((value: SandboxRequestResponse<T>) => TResult1 | Thenable<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | Thenable<TResult2>) | undefined | null): Thenable<TResult1 | TResult2>;
}

interface HubSandbox {
    // Env
    readonly env: {
        readonly define(path: string, obj: any): void;
        readonly document?: Document,
        readonly window?: Window & typeof globalThis,
    };

    // Logging
    readonly log: LogHost;

    // JSON
    readonly fromJson: (str: string) => any;
    readonly toJson: (obj: any, indent?: number) => string | null;

    // PubSub
    readonly publish(channel: unknown, data?: unknown): void;
    readonly subscribe(channel: unknown, listener: () => void): Unsubscribe;

    // Request
    readonly request: {
        <T = unknown>(url: string, options?: SandboxRequestOptions): SandboxRequest<T>;
        readonly json: <T = unknown>(url: string, options?: SandboxRequestOptions) => SandboxRequest<T>;
    };
}

interface HubStatic {
    readonly log: (...rest: any[]) => void;
    readonly config(fn: (sandbox: HubSandbox) => any);
    readonly use(fn: (sandbox: HubSandbox) => void): void;
}

declare const Hub: HubStatic;
