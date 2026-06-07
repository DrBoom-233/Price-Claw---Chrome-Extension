import test from "node:test";
import { deepEqual, equal, throws } from "node:assert/strict";
import { extractJsonText, parseJsonResponse } from "../src/lib/json";

test("extractJsonText strips fenced JSON", () => {
  equal(extractJsonText("```json\n{\"ok\":true}\n```"), "{\"ok\":true}");
});

test("extractJsonText finds embedded JSON", () => {
  equal(extractJsonText("Here is the result:\n[{\"price\":\"$1\"}]\nthanks"), "[{\"price\":\"$1\"}]");
});

test("parseJsonResponse returns parsed values", () => {
  deepEqual(parseJsonResponse("[{\"item\":\"milk\"}]"), [{ item: "milk" }]);
});

test("extractJsonText rejects responses without JSON", () => {
  throws(() => extractJsonText("no structured output"), /did not contain JSON/);
});

