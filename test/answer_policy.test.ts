import assert from "node:assert/strict";
import test from "node:test";
import { chooseDisposition } from "../src/answer_policy.js";

test("routes sensitive donor receipt questions to finance review", () => {
  assert.equal(chooseDisposition("Can I include our bank account on this donor receipt?"), "finance_review");
  assert.equal(chooseDisposition("When are annual donor receipts sent?"), "answer");
});
