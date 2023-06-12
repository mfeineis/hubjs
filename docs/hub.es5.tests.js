// ECMAScript 5 Testsuite

self.Tests = self.Tests || {};
self.Tests.Hub_es5_tests = Hub_es5_tests;

function Hub_es5_tests(describe, expect, baseUrl) {
    const window = self;
    const document = window.document;

    /** @type {HubStatic} */
    const Hub = self.Hub;

    function mapFileUrl(file) {
        return baseUrl + file;
    }

    describe("Hub", it => {
        it("should be globally available", () => {
            expect(typeof Hub).toBe("object");
            expect(Hub).not.toBe(null);
        });
    });

    describe("Hub.config", it => {
        it("should be a static method", () => {
            expect(typeof Hub.config).toBe("function");
            expect(Hub.config.name).toBe("config");
        });
    });

    describe("Hub.log", it => {
        it("should be a static method", () => {
            expect(typeof Hub.log).toBe("function");
            expect(Hub.log.name).toBe("log");
        });
    });

    const createSandbox = function () {
        /** @type {HubSandbox} */
        let sandbox;
        Hub.use(function (Y) {
            sandbox = Y;
        });
        return sandbox;
    };

    describe("Hub.use", it => {
        it("should be a static method", () => {
            expect(typeof Hub.use).toBe("function");
            expect(Hub.use.name).toBe("use");
        });
        it("should provide a sandbox synchronously", () => {
            const sandbox = createSandbox();
            expect(typeof sandbox).toBe("object");
        });
        it("should provide a frozen sandbox that can't be tinkered with", () => {
            const sandbox = createSandbox();
            try {
                sandbox.mutated = true;
            } catch (e) {
                if (e instanceof TypeError && /object is not extensible/.test(e.message)) {
                    // Deno throws an error whereas browsers just ignore it
                } else {
                    throw e;
                }
            }

            expect(sandbox.mutated).not.toBe(true);
        });
        it("should provide a fresh sandbox on every call", () => {
            const a = createSandbox();
            const b = createSandbox();

            expect(a).not.toBe(b);
        });
        it("should provide a sandbox where 'env' provides the expected values", () => {
            const sandbox = createSandbox();

            expect(typeof sandbox.env.define).toBe("function");
            expect(sandbox.env.document).toBe(document);
            expect(sandbox.env.window).toBe(window);
        });
        it("should provide a sandbox with the 'log' extension", () => {
            const sandbox = createSandbox();

            expect(typeof sandbox.log).toBe("function");
            expect(typeof sandbox.log.error).toBe("function");
        });
        it("should provide a sandbox with the 'json' extension", () => {
            const sandbox = createSandbox();

            expect(typeof sandbox.fromJson).toBe("function");
            expect(typeof sandbox.toJson).toBe("function");
        });
        it("should provide a sandbox with the 'callbag' extension", () => {
            const sandbox = createSandbox();

            expect(typeof sandbox.forEach).toBe("function");
        });
        it("should provide a sandbox with the 'pubsub' extension", () => {
            const sandbox = createSandbox();

            expect(typeof sandbox.publish).toBe("function");
            expect(typeof sandbox.subscribe).toBe("function");
        });
        it("should provide a sandbox with the 'request' extension", () => {
            const sandbox = createSandbox();

            expect(typeof sandbox.request).toBe("function");
            expect(typeof sandbox.request.json).toBe("function");
        });
    });

    describe("Hub 'request' extension", it => {
        it("should be available as a sandbox API", () => {
            const Y = createSandbox();

            expect(typeof Y.request).toBe("function");
            expect(typeof Y.request.json).toBe("function");
        });
        it("should return a [[Thenable]] handle that also has a 'subscribe' method", () => {
            const Y = createSandbox();

            const req = Y.request(mapFileUrl("fixtures/plaintext.txt"));

            expect(typeof req.subscribe).toBe("function");
            expect(typeof req.then).toBe("function");
        });
        it("should request text by default", () => {
            const Y = createSandbox();

            const req = Y.request(mapFileUrl("fixtures/plaintext.txt"));

            let step = 0;
            const sub = req.subscribe();
            Y.forEach(function (pair) {
                step += 1;

                const ev = pair[0];
                const data = pair[1];

                if (step === 1 && ev === "ok") {
                    // xhr polyfill in Deno doesn't trigger "progress" events
                    step = 2;
                }

                switch (step) {
                    case 1:
                        expect(ev).toBe("progress");
                        expect(typeof data.error).toBe("undefined");
                        expect(data.indeterminate).toBe(undefined);
                        expect(data.progress).toBe(100);
                        break;
                    case 2:
                        expect(ev).toBe("ok");
                        expect(typeof data.error).toBe("undefined");
                        expect(data.ok).toBe(true);
                        expect(data.response).toBe("A plain text file\n");
                        expect(data.status).toBe(200);
                        break;
                    case 3:
                        expect(ev).toBe("complete");
                        expect(typeof data.error).toBe("undefined");
                        expect(data.ok).toBe(true);
                        expect(data.loaded).toBe(18);
                        expect(data.status).toBe(200);
                        break;
                    default:
                        throw new Error("There should be exactly 3 steps");
                }
            })(sub);

            expect(typeof sub.unsubscribe).toBe("function");
            sub.unsubscribe();
        });
        it.skip("[UNOFFICIAL sync] should request text by default", () => {
            const Y = createSandbox();

            const req = Y.request(mapFileUrl("fixtures/plaintext.txt"), {
                __UNOFFICIAL_DO_NOT_USE__: {
                    sync: true,
                },
            });

            let step = 0;
            const sub = req.subscribe();
            Y.forEach(function (pair) {
                step += 1;

                const ev = pair[0];
                const data = pair[1];

                switch (step) {
                    case 1:
                        expect(ev).toBe("ok");
                        expect(typeof data.error).toBe("undefined");
                        expect(data.ok).toBe(true);
                        expect(data.response).toBe("A plain text file\n");
                        expect(data.status).toBe(200);
                        break;
                    case 2:
                        expect(ev).toBe("complete");
                        expect(typeof data.error).toBe("undefined");
                        expect(data.ok).toBe(true);
                        expect(data.loaded).toBe(18);
                        expect(data.status).toBe(200);
                        break;
                    default:
                        throw new Error("There should be exactly 2 steps");
                }
            })(sub);

            expect(typeof sub.unsubscribe).toBe("function");
            sub.unsubscribe();
        });
        it("should support requesting json", () => {
            const Y = createSandbox();

            const req = Y.request.json(mapFileUrl("fixtures/jsontext.json"));

            let step = 0;
            const sub = req.subscribe();
            Y.forEach(function (pair) {
                step += 1;

                const ev = pair[0];
                const data = pair[1];

                if (step === 1 && ev === "ok") {
                    // xhr polyfill in Deno doesn't trigger "progress" events
                    step = 2;
                }

                switch (step) {
                    case 1:
                        expect(ev).toBe("progress");
                        expect(typeof data.error).toBe("undefined");
                        expect(data.indeterminate).toBe(undefined);
                        expect(data.progress).toBe(100);
                        break;
                    case 2:
                        expect(ev).toBe("ok");
                        expect(typeof data.error).toBe("undefined");
                        expect(data.ok).toBe(true);
                        expect(typeof data.response).toBe("object");
                        expect(Y.toJson(data.response)).toBe(
                            '{"number":42,"string":"The answer","null":null,"object":{"array":[1,"2",null,4]}}'
                        );
                        expect(data.loaded).toBe(125);
                        expect(data.status).toBe(200);
                        break;
                    case 3:
                        expect(ev).toBe("complete");
                        expect(typeof data.error).toBe("undefined");
                        expect(data.ok).toBe(true);
                        expect(data.loaded).toBe(125);
                        expect(data.status).toBe(200);
                        break;
                    default:
                        throw new Error("There should be exactly 3 steps");
                }
            })(sub);

            expect(typeof sub.unsubscribe).toBe("function");
            sub.unsubscribe();
        });
    });
}
