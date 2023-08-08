/* global define, module */
/*! Hub v0.1.2 https://www.github.com/mfeineis/hubjs */
/// Changelog
/// =========
/// * v0.1.2
///     - Fixed bug in `request` where early return from subscription would yield a "noop" function
///     - Fixed docs for `request` subscription
/// * v0.1.1
///     - AbortSignal support for `request` - see https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
///     - Don't set JSON request headers when `SandboxRequestOptions.body` is `null`
///     - Fixed TypeScript interface for `Hub.log`, now returns the proper `LogHost`
///     - Fixed `Hub.d.ts` style issues
///     - Introduced `callbag` extension - see https://github.com/callbag/callbag
///     - Subscriptions in `request` and `pubsub` now use a callbag-based API
/// * v0.1.0
///     - Created GitHub repository for the library
///     - Moved TODO/FIXME to hubjs GitHub project for later consideration
///     - Added `log.error` in logging extension
///     - Removed tracking extension for now, not sure this is the way to go
///     - Removed request.touch for now, can easily be replicated with a normal GET request
///     - Request extension API breaking change: request now returns response object with meta data attached
///     - Hardened request extension error handling
/// * v0.0.11
///     - `request` now correctly sets headers *after* opening the connection
///     - Refined TypeScript declaration for `request` extension for improved editor support in vscode
///     - Removed unnecessary `request.text` and `request.document` utilities
/// * v0.0.10
///     - Wrap JSON.stringify/.parse API in sandbox, we need it all the time and the global API is not the best
///     - Freeze global API straight after replay and throw on later intents to call ".config()"
///     - Added some inline documentation
/// * v0.0.9
///     - Include a very lean Hub stub so script order doesn't matter
///     - Remove Hub.version, we explicitly don't want to version our Hub API
///     - Rename `namespace` helper to `define`
///     - Make `Hub` a plain object, it being a function serves no purpose right now
/// * v0.0.8
///     - Rename `Core` to `Hub`
///     - Introduce `namespace` helper for globals
///     - Some more work on the request extension
(function (window, factory, extensions) {
    "use strict";

    if (this === window) {
        // Let's hope nobody ever has to see this error message
        throw new Error("A spec-compliant ES5 environment is required!");
    }

    // Grabbing the configured stub, if available
    const stub = window["Hub"];
    delete window["Hub"];

    const lib = factory(extensions, window, window.document);

    window["Hub"] = lib;

    // Information gathered from global API calls on the stub will now be
    // replayed preserving order
    function replay(api, calls) {
        (calls || []).forEach(function (args) {
            lib[api].apply(null, args);
        });
    }

    if (stub && stub.config && stub.use) {
        replay("config", stub.config._);
        replay("log", stub.log._);
        replay("use", stub.use._);
    }

    // Nobody is allowed to touch the library internals once all extensions
    // are in place
    Object.freeze(lib);

}(self, function (extensions, window, document) {

    function assign(target, path, obj) {
        const parts = path.split(".");
        const len = parts.length;
        let it = target;
        let i = 0;
        while (i < len) {
            const key = parts[i];
            if (i === len - 1) {
                it[key] = obj;
                break;
            }
            if (typeof it[key] === "undefined") {
                it[key] = {};
            }
            it = it[key];
            i += 1;
        }
    }

    const exports = {};

    function Sandbox() {
        return Object.freeze(this);
    }
    delete Sandbox.prototype.constructor;

    function expose(name, it) {
        assign(Sandbox.prototype, name, it);
    }

    assign(exports, "use", function use(fn) {
        fn(new Sandbox());
    });

    assign(exports, "config", function config(fn) {
        if (Object.isFrozen(exports)) {
            throw new Error(
                ".config() API must be called synchronously!"
            );
        }
        const config = fn(new Sandbox());
        if (!Boolean(config)) {
            throw new Error("No configuration provided");
        }
        for (let key in config) {
            const next = Sandbox.prototype[key];
            if (!Boolean(next)) {
                throw new Error([
                    "Encountered configuration for unknown middleware '", key, "'"
                ].join(""));
            }
            const middleware = config[key];
            const decorated = middleware(next);
            expose(key, decorated);
            if (key in exports) {
                exports[key] = decorated;
            }
        }
    });

    const env = {};
    env["window"] = window;
    env["document"] = document;
    env["define"] = assign.bind(null, window);
    expose("env", env);

    const exposeStatic = assign.bind(null, exports);
    for (let key in extensions) {
        extensions[key](expose, new Sandbox(), exposeStatic);
    }

    return exports;

}, [
/**
 * @param {(name: string, obj: any) => void} sandboxApi
 * @param {HubSandbox} Y
 * @summary Browser implementation of the pubsub extension via `window.postMessage`.
 */
function pubsubPostMessageExtension(sandboxApi, Y) {

    sandboxApi("publish", publish);
    sandboxApi("subscribe", subscribe);

    const window = Y.env.window;
    const btoa = window.btoa;

    const sentinel = ["hub.pubsub.realm:", btoa(String(Math.random()))].join("").replace("=", ""); // { sentinel: 1 };
    const listeners = {};

    window.addEventListener("message", function (e) {
        if (e.origin !== window.origin) {
            return;
        }
        if (typeof e.data !== "object" || e.data.$ !== sentinel) {
            return;
        }
        const channel = e.data.channel;
        const data = e.data.data;
        const channelListeners = listeners[channel] || [];
        for (let key in channelListeners) {
            const listener = channelListeners[key];
            try {
                listener(data);
            } catch (e) {
                const errorInfo = {
                    filename: e.fileName,
                    lineno: e.lineNumber,
                    message: e.message,
                    stack: e.stack,
                };
                log.error(errorInfo, e);
                publish("hub:error", errorInfo);
            }
        }
    });

    function publish(channel, data) {
        window.postMessage({
            $: sentinel,
            channel: channel,
            data: data
        });
    }

    function subscribe(channel) {
        if (!listeners[channel]) {
            listeners[channel] = [];
        }

        let fn = null;

        function unsubscribe() {
            listeners[channel] = listeners[channel].filter(function (it) {
                return it !== fn;
            });
        }

        function sub(start, sink) {
            if (start !== 0) {
                return;
            }
            fn = function (data) {
                sink(1, data);
            };
            listeners[channel].push(fn);

            sink(0, function (t) {
                if (t === 2) {
                    unsubscribe();
                }
            });
        }
        sub.unsubscribe = unsubscribe;

        return sub;
    }

},
/**
 * @param {(name: string, obj: any) => void} sandboxApi
 * @param {HubSandbox} Y
 * @param {(name: string, obj: any) => void} staticApi
 * @summary Browser implementation of the logging extension.
 */
function loggingExtension(sandboxApi, Y, staticApi) {

    staticApi("log", log);
    sandboxApi("log", log);

    const window = Y.env.window;
    const publish = Y.publish;

    function log() {
        return console.log.apply(console, arguments);
    }
    log.error = function error() {
        return console.error.apply(console, arguments);
    };

    window.addEventListener("error", function (ev) {
        const error = {
            colno: ev.colno,
            filename: ev.filename,
            lineno: ev.lineno,
            message: ev.error.message,
            stack: ev.error.stack,
        };
        log.error(error, ev);
        publish("hub:error", error);
    });

},
/**
 * @param {(name: string, obj: any) => void} sandboxApi
 * @param {HubSandbox} Y
 * @summary Browser implementation of the JSON extension.
 * @description Right now this is just a thin wrapper for the awkward but standard JSON API.
 */
function jsonExtension(sandboxApi, Y) {
    const JSON = Y.env.window.JSON;

    sandboxApi("fromJson", fromJson);
    sandboxApi("toJson", toJson);

    function fromJson(str) {
        return JSON.parse(str);
    }

    function toJson(obj, indent) {
        return JSON.stringify(obj, null, indent);
    }
},
/**
 * @param {(name: string, obj: any) => void} sandboxApi
 * @summary Callbag compatible utility functions to use with subscriptions.
 * @see https://github.com/callbag/callbag
 */
function callbagExtension(sandboxApi) {
    sandboxApi("forEach", forEach);

    function forEach(operation) {
        return function (source) {
            let talkback;
            source(0, function (t, d) {
                if (t === 0) {
                    talkback = d;
                }
                if (t === 1) {
                    operation(d);
                }
                if (t === 1 || t === 0) {
                    talkback(1);
                }
            });
        };
    }
},
/**
 * @param {(name: string, obj: any) => void} sandboxApi
 * @param {HubSandbox} Y
 * @summary Browser implementation of the request extension via `XMLHttpRequest`.
 */
function requestViaXHRExtension(sandboxApi, Y, _, undefined) {

    sandboxApi("request", request);

    const window = Y.env.window;
    const log = Y.log;
    const forEach = Y.forEach;

    function mix(to) {
        const len = arguments.length;
        for (let i = 1; i < len; i += 1) {
            const from = arguments[i];
            for (let key in from) {
                to[key] = from[key];
            }
        }
        return to;
    }

    function request(url, options) {
        options = options || {};

        const body = options.body || null;
        const headers = options.headers || {};
        const method = options.method || "GET";
        const params = options.params || {};
        // options.responseType is "text" by default per spec
        const responseType = options.responseType || "";
        const signal = options.signal || null;
        // options.sync is not part of the published API but it is convenient
        // for testing so it works for this implementation without official support
        const sync = Boolean((options.__UNOFFICIAL_DO_NOT_USE__ || {}).sync);
        const timeout = options.timeout || 10 * 1000;
        const withCredentials = Boolean(options.withCredentials);

        let hasBeenSent = false;
        let isDone = false;
        let hasContentType = false;
        let openError = null;
        let sendError = null;
        let loadError = null;

        let listeners = [];

        function determineError() {
            return loadError || openError || sendError || undefined;
        }

        function pump(fn, rawData) {
            try {
                fn(rawData);
            } catch (e) {
                throw e;
                // log.error(e);
                // throw new Error("[invariant] Subscription handlers should never throw", {
                //     cause: e,
                // });
            }
        }
        function pumpMany(fns, rawData) {
            fns.forEach(function (fn) {
                pump(fn, rawData);
            });
        }

        let xhr = new window.XMLHttpRequest();

        const q = Object.keys(params).map(function (key) {
            return key + "=" + encodeURIComponent(params[key]);
        }).join("&");
        const query = url.indexOf("?") >= 0 ? "&" + q : "?" + q;

        /** @type unknown */
        let response = null;
        let responseStatus = null;
        let responseOk = false;

        xhr.addEventListener("progress", function (ev) {
            if (!ev.lengthComputable) {
                return;
            }
            loadedBytes = ev.loaded;
            pumpMany(listeners, ["progress", {
                indeterminate: ev.indeterminate,
                loaded: ev.loaded,
                progress: ev.loaded / ev.total * 100,
                total: ev.total,
            }]);
        });
        xhr.addEventListener("load", function (ev) {
            response = xhr.response;
            responseStatus = xhr.status;
            isDone = true;

            const status = xhr.status;
            let marker = "error";
            if (status === 0 || (status >= 200 && xhr.status < 400)) {
                marker = "ok";
                responseOk = true;
            } else {
                loadError = mix(new Error(xhr.statusText + " (" + status + ")"), {
                    loaded: ev.loaded,
                    status: status,
                    statusText: xhr.statusText,
                });
            }

            pumpMany(listeners, [marker, {
                error: determineError(),
                loaded: ev.loaded,
                ok: responseOk,
                response: response,
                status: status,
            }]);
        });
        xhr.addEventListener("error", function () {
            isDone = true;
            pumpMany(listeners, ["error", null]);
        });
        xhr.addEventListener("abort", function () {
            isDone = true;
            pumpMany(listeners, ["abort", null]);
        });
        xhr.addEventListener("loadend", function (ev) {
            pumpMany(listeners, ["complete", {
                loaded: ev.loaded,
                ok: responseOk,
                status: responseStatus,
            }]);
            xhr = null;
            listeners = null;
        });

        if (signal) {
            signal.addEventListener("abort", function listener() {
                if (xhr) {
                    xhr.abort();
                }
                signal.removeEventListener("abort", listener);
            });
        }

        if (!sync) {
            // Timeout is only supported with async requests
            xhr.timeout = timeout;
            xhr.addEventListener("timeout", function () {
                responseStatus = 408;
                pumpMany(listeners, ["timeout", {
                    error: new Error("Timeout after " + timeout + "ms"),
                    status: responseStatus,
                }]);
            });
        }

        xhr.responseType = responseType;
        if (withCredentials) {
            xhr.withCredentials = withCredentials;
        }

        try {
            xhr.open(method, q.length ? url + query : url, !sync);

            Object.keys(headers).forEach(function (key) {
                if (/^Content-Type$/i.test(key)) {
                    hasContentType = true;
                }
                xhr.setRequestHeader(key, headers[key]);
            });
            if (!hasContentType && body !== null) {
                if (body instanceof ArrayBuffer || body instanceof Blob || body instanceof DataView || body instanceof Document || body instanceof FormData || body instanceof URLSearchParams) {
                    // Per fetch spec these are allowed and `XMLHttpRequest` as
                    // well as `fetch` know what to do with these without an
                    // explicit "Content-Type"
                } else if (typeof body === "object" && body !== null) {
                    // Sending JSON is such a ubiquitous usecase that setting
                    // a sensible default "Content-Type" is a no-brainer
                    xhr.setRequestHeader(
                        "Content-Type", "application/json; charset=utf-8"
                    );
                } else {
                    const err = new Error('Given "request" body not supported');
                    log.error(err);
                    throw err;
                }
            }
        } catch (e) {
            openError = e;
        }

        /** @type {SandboxRequest<T>} */
        const api = {};
        // Our API is a [[Thenable]] so it can be `await`-ed
        api["then"] = function then(onfulfilled, onrejected) {
            const sub = api.subscribe();
            forEach(function (pair) {
                const ev = pair[0];
                const unsafe = pair[1];
                const safe = unsafe || {};
                switch (ev) {
                    case "abort":
                        onrejected(safe.error || new Error("hub.request:abort"));
                        break;
                    case "complete":
                        sub.unsubscribe();
                        break;
                    case "error":
                        onrejected(safe.error || new Error("hub.request:error"));
                        break;
                    case "progress":
                        // Can't report progress for a PromiseLike<T>
                        break;
                    case "ok":
                        onfulfilled(unsafe);
                        break;
                    case "timeout":
                        onrejected(safe.error || new Error("hub.request:timeout"));
                        break;
                }
            })(sub);
        };

        // This returns a cold subscription, the request is initiated on demand
        api["subscribe"] = function subscribe() {
            let fn = null;

            function finalize() {
                const error = determineError();
                pump(fn, [error ? "error" : "ok", {
                    error: error,
                    response: response,
                    status: xhr ? xhr.status : null,
                }]);
            }

            function unsubscribe() {
                if (fn && listeners) {
                    listeners = listeners.filter(function (it) {
                        return it !== fn;
                    });
                }
                if (!xhr) {
                    return;
                }
                if (listeners && listeners.length === 0) {
                    xhr.abort();
                }
            }

            function sub(start, sink) {
                if (start !== 0) {
                    return;
                }

                fn = function (data) {
                    sink(1, data);
                };

                sink(0, function (t) {
                    if (t === 2) {
                        unsubscribe();
                    }
                });

                if (isDone) {
                    finalize();
                    return;
                }
                listeners.push(fn);

                if (!hasBeenSent) {
                    try {
                        xhr.send(body);
                        hasBeenSent = true;
                    } catch (e) {
                        sendError = e;
                        finalize();
                    }
                }
            }
            sub.unsubscribe = unsubscribe;

            return sub;
        };

        return Object.freeze(api);
    };

    request["json"] = function requestJson(url, options) {
        return request(url, mix({}, options, {
            responseType: "json",
        }));
    };

},
]));
