import test from "node:test";
import { deepEqual, equal, ok } from "node:assert/strict";
import { matchKeyValues, rankCandidates, scoreTextAgainstKeys, tokenize } from "../src/lib/domMatching";

test("tokenize keeps price-like tokens", () => {
  deepEqual(tokenize("Organic Milk - $4.99 / 2L"), ["organic", "milk", "$4.99", "2l"]);
});

test("matchKeyValues flattens item price and key fields", () => {
  deepEqual(matchKeyValues([{ item: "Milk", price: "$4.99" }, { key: "Banana" }]), ["Milk", "$4.99", "Banana"]);
});

test("scoreTextAgainstKeys prefers exact and partial matches", () => {
  equal(scoreTextAgainstKeys("Organic Milk", ["Organic Milk"]).score, 1);
  ok(scoreTextAgainstKeys("Organic Milk 2L carton", ["Milk 2L"]).score > 0.7);
});

test("rankCandidates orders likely matching text blocks first", () => {
  const ranked = rankCandidates(
    [
      { id: "a", text: "unrelated navigation" },
      { id: "b", text: "Organic Milk 2L $4.99" }
    ],
    [{ item: "Organic Milk", price: "$4.99" }]
  );
  equal(ranked[0].id, "b");
});

