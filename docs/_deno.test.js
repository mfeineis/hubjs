import { assert, assertStrictEquals } from "https://deno.land/std@0.178.0/testing/asserts.ts";
import "https://deno.land/x/xhr@0.3.0/mod.ts";

import "./hub.dev.js";
import "./hub.es5.tests.js";
import "./hub.modern.tests.js";

function describe(name, fn) {
    Deno.test(name, async (t) => {
        const plan = [];

        function it(stepName, fn2) {
            plan.push([stepName, fn2]);
        }
        it.skip = () => {};

        fn(it);

        for (const [stepName, fn2] of plan) {
            await t.step(stepName, () => {
                fn2();
            });
        }
    })
}
describe.skip = () => {};

describe.expect = function expect(obj, msg) {
    return {
        toBe(expected) {
            assertStrictEquals(obj, expected, msg);
        },
        not: {
            toBe(expected) {
                assert(obj !== expected, msg);
            },
        },
    };
};

self.postMessage = () => {};

// Smoke tests for test environment
assertStrictEquals(typeof self.postMessage, "function");
assertStrictEquals(typeof self.XMLHttpRequest, "function");

assertStrictEquals(typeof self.Hub, "object");
assertStrictEquals(typeof self.Tests.Hub_es5_tests, "function");
assertStrictEquals(typeof self.Tests.Hub_modern_tests, "function");

const baseUrl = `file://${Deno.cwd()}/`;
console.log("baseUrl", baseUrl);

self.Tests.Hub_es5_tests(describe, describe.expect, baseUrl);
self.Tests.Hub_modern_tests(describe, describe.expect, baseUrl);
