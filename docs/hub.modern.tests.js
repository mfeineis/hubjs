// ES6+ Testsuite

self.Tests = self.Tests || {};
self.Tests.Hub_modern_tests = Hub_modern_tests;

function Hub_modern_tests(describe, expect, baseUrl) {
    const window = self;
    const document = window.document;

    /** @type {HubStatic} */
    const Hub = self.Hub;

    function mapFileUrl(file) {
        return baseUrl + file;
    }

    const createSandbox = function () {
        /** @type {HubSandbox} */
        let sandbox;
        Hub.use(function (Y) {
            sandbox = Y;
        });
        return sandbox;
    };

    describe("[ES6+] Hub 'request' extension", it => {
        it("should be usable with 'await' because it returns a [[Thenable]]", async () => {
            const { request } = createSandbox();

            const res = await request.text(mapFileUrl("fixtures/plaintext.txt"));
            expect(typeof res.error).toBe("undefined");
            expect(res.ok).toBe(true);
            expect(res.response).toBe("A plain text file\n");
            expect(res.status).toBe(200);
        });
        it("should be able to 'await' json requests", async () => {
            const { request, toJson } = createSandbox();

            const res = await request(mapFileUrl("fixtures/jsontext.json"));
            expect(typeof res.error).toBe("undefined");
            expect(res.ok).toBe(true);
            expect(toJson(res.response)).toBe('{"number":42,"string":"The answer","null":null,"object":{"array":[1,"2",null,4]}}');
            expect(res.loaded).toBe(125);
            expect(res.status).toBe(200);
        });
        it("should support try/catch error handling when using 'await'", async () => {
            const { request } = createSandbox();

            try {
                await request.text(mapFileUrl("fixtures/__404__.txt"));
                throw new Error("This request should not succeed");
            } catch (e) {
                expect(typeof e).not.toBe("undefined");
                // FIXME: xhr polyfill doesn't set 404 status
                //expect(e.status).toBe(404);
            }
        });
        it("[UNOFFICIAL sync] should be usable with 'await' because it returns a [[Thenable]]", async () => {
            const { request } = createSandbox();

            const res = await request.text(mapFileUrl("fixtures/plaintext.txt"), {
                __UNOFFICIAL_DO_NOT_USE__: {
                    sync: true,
                },
            });
            expect(typeof res.error).toBe("undefined");
            expect(res.ok).toBe(true);
            expect(res.response).toBe("A plain text file\n");
            expect(res.status).toBe(200);
        });
    });
}
