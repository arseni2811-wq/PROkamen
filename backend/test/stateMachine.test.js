const test = require("node:test");
const assert = require("node:assert/strict");
const { canTransition, ALL_STATUSES } = require("../utils/stateMachine");

test("current kanban policy permits transitions between known statuses", () => {
  for (const from of ALL_STATUSES) {
    for (const to of ALL_STATUSES) {
      assert.equal(canTransition(from, to), true, `${from} -> ${to}`);
    }
  }
});

test("state machine rejects unknown target statuses", () => {
  assert.equal(canTransition("lead", "deleted"), false);
  assert.equal(canTransition("lead", "' OR 1=1 --"), false);
});
