import test from "node:test";
import { deepEqual, throws } from "node:assert/strict";
import { normalizeSelectorConfig, pairFieldValues } from "../src/lib/selectorExecutor";

test("pairFieldValues pairs independent field arrays by index", () => {
  deepEqual(pairFieldValues({ item: ["Milk", "Bread"], price: ["$4.99"] }), [
    { item: "Milk", price: "$4.99" },
    { item: "Bread", price: "" }
  ]);
});

test("normalizeSelectorConfig validates required selector fields", () => {
  deepEqual(
    normalizeSelectorConfig({
      container_selector: ".product",
      expected_fields: [{ name: "item", selector: ".name" }]
    }),
    {
      website_type: undefined,
      description: undefined,
      container_selector: ".product",
      expected_fields: [{ name: "item", selector: ".name" }]
    }
  );
});

test("normalizeSelectorConfig rejects missing expected fields", () => {
  throws(() => normalizeSelectorConfig({ container_selector: ".product", expected_fields: [] }), /expected_fields/);
});

