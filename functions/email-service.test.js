const test = require("node:test");
const assert = require("node:assert/strict");

const { getUniqueEmailRecipients } = require("./email-service");

test("getUniqueEmailRecipients deduplicates base and admin notification emails", () => {
  assert.deepEqual(
    getUniqueEmailRecipients("notify@example.org", ["a@example.org", "notify@example.org", "", "a@example.org"]),
    ["notify@example.org", "a@example.org"],
  );
});
