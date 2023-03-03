import { assert, assertStrictEquals } from "https://deno.land/std@0.178.0/testing/asserts.ts";
import "https://deno.land/x/xhr@0.3.0/mod.ts";

import "./hub.dev.js";

const baseUrl = `file://${Deno.cwd()}/`;

function mapFileUrl(file) {
    return `${baseUrl}${file}`;
}

const createSandbox = () => {
    /** @type {HubSandbox} */
    let sandbox;
    Hub.use(Y => {
        sandbox = Y;
    })
    return sandbox;
};

Deno.test("XMLHttpRequest polyfill is present and working by itself", { permissions: { read: true } }, async () => {
    assert(typeof XMLHttpRequest === "function", "XMLHttpRequest should be present");

    const fileUrl = mapFileUrl("fixtures/plaintext.txt");

    /** @type {XMLHttpRequest} */
    const res = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () {
            if (xhr.readyState === xhr.DONE) {
                resolve({
                    ok: true,
                    response: xhr.response,
                    status: xhr.status,
                });
            }
        };
        xhr.onerror = function () {
            reject({
                ok: false,
                response: xhr.response,
                status: xhr.status,
            });
        };
        xhr.open("GET", fileUrl, true);
        xhr.send();
    });

    assertStrictEquals(res.ok, true);
    assertStrictEquals(res.response, "A plain text file\n");
    assertStrictEquals(res.status, 200);
});

Deno.test("XMLHttpRequest polyfill is used in 'request' extension", { permissions: { read: true } }, async () => {
    assert(typeof XMLHttpRequest === "function", "XMLHttpRequest should be present");

    const fileUrl = mapFileUrl("fixtures/plaintext.txt");

    const { request } = createSandbox();
    /** @type {SandboxRequestResponse<string>} */
    const res = await request(fileUrl);

    assertStrictEquals(res.ok, true);
    assertStrictEquals(res.response, "A plain text file\n");
    assertStrictEquals(res.status, 200);
});
