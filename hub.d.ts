
interface LogHost {
    (...args: unknown[]): void;
    readonly error: (...args: unknown[]) => void;
}

interface ColdCallbagSubscription<T = unknown> {
    (start: START | DATA | END, sink: Sink<T>): void;
    unsubscribe: () => void;
}

// Note that our `request` options are intentionally leaner
// in scope than what is defined in the Fetch spec for now
interface SandboxRequestOptions {
    body?: string | Blob | BufferSource | FormData | ReadableStream | unknown;
    headers?: Record<string, string>;
    method?: "DELETE" | "GET" | "OPTIONS" | "PATCH" | "POST" | "PUT";
    params?: Record<string, unknown>;
    responseType?: "" | "arraybuffer" | "blob" | "document" | "json" | "text";
    signal?: AbortSignal;
    timeout?: number;
    withCredentials?: boolean;
}

type SandboxRequestEvent = "progress" | "ok" | "error" | "complete" | "timeout" | "abort";

interface SandboxRequestProgress<T> {
    readonly error?: Error,
    readonly indeterminate?: boolean,
    readonly loaded?: number,
    readonly ok: boolean,
    readonly progress?: number,
    readonly response?: T,
    readonly status?: number,
    readonly total?: number,
}
interface SandboxRequestResponse<T> extends SandboxRequestProgress<T> {
}
interface SandboxRequest<T> extends Thenable<T> {
    subscribe(): ColdCallbagSubscription<[name: SandboxRequestEvent, evt: SandboxRequestProgress<T>]>;

    // Our API is a [[Thenable]] so it can be `await`-ed
    // a.k.a. PromiseLike<T>
    then<TResult1 = SandboxRequestResponse<T>, TResult2 = never>(onfulfilled?: ((value: SandboxRequestResponse<T>) => TResult1 | Thenable<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | Thenable<TResult2>) | undefined | null): Thenable<TResult1 | TResult2>;
}

interface HubSandbox {
    // Env
    readonly env: {
        define(path: string, obj: any): void;
        readonly document?: Document,
        readonly window?: Window & typeof globalThis,
    };

    // Logging
    readonly log: LogHost;

    // JSON
    readonly fromJson: (str: string) => any;
    readonly toJson: (obj: any, indent?: number) => string | null;

    // PubSub
    readonly publish: <T = unknown>(channel: unknown, data?: T) => void;
    readonly subscribe: <T = unknown>(channel: unknown) => ColdCallbagSubscription<T>;

    // Request
    readonly request: {
        <T = unknown>(url: string, options?: SandboxRequestOptions): SandboxRequest<T>;
        readonly text: <T = unknown>(url: string, options?: SandboxRequestOptions) => SandboxRequest<T>;
    };

    // Callbag operators
    forEach: <T>(operation: (data: T) => void) => (source: Source<T>) => void;
}

interface HubStatic {
    readonly log: LogHost;
    readonly config: (fn: (sandbox: HubSandbox) => any) => void;
    readonly use: (fn: (sandbox: HubSandbox) => void) => void;
}

declare const Hub: HubStatic;

// See https://github.com/callbag/callbag

type START = 0;
type DATA = 1;
type END = 2;
type RESERVED_3 = 3;
type RESERVED_4 = 4;
type RESERVED_5 = 5;
type RESERVED_6 = 6;
type RESERVED_7 = 7;
type RESERVED_8 = 8;
type RESERVED_9 = 9;

type CallbagArgs<I, O> =
  // handshake:
  | [type: START, talkback: Callbag<O, I>]
  // data from source:
  | [type: DATA, data: I]
  // pull request:
  | [type: DATA]
  // error:
  | [type: END, error: unknown]
  // end without error:
  | [type: END, _?: undefined]

/**
 * A Callbag dynamically receives input of type I
 * and dynamically delivers output of type O
 */
interface Callbag<I, O> {
  (...args: CallbagArgs<I, O>): void
}

/**
 * A source only delivers data
 */
interface Source<T> extends Callbag<never, T> {}

/**
 * A sink only receives data
 */
interface Sink<T> extends Callbag<T, never> {}

type SourceFactory<T> = (...args: Array<any>) => Source<T>;

type SourceOperator<T, R> = (
  ...args: Array<any>
) => (source: Source<T>) => Source<R>;

/**
 * Conditional types for contained type retrieval
 */
type UnwrapSource<T extends Source<any>> = T extends Source<infer R> ? R : never;
type UnwrapSink<T extends Sink<any>> = T extends Sink<infer R> ? R : never;
