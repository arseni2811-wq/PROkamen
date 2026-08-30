const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadAttachmentUi() {
  const context = vm.createContext({ Promise });
  const source = fs.readFileSync(
    path.resolve(__dirname, "../../public/crm/crm/js/attachments.js"),
    "utf8",
  );
  vm.runInContext(source, context);
  return context.AttachmentUI;
}

function fakeButton() {
  const listeners = {};
  return {
    disabled: false,
    addEventListener(type, listener) { listeners[type] = listener; },
    click(event) { return listeners.click(event); },
  };
}

test("attachment delete cancellation sends no request and stops link action", async () => {
  const ui = loadAttachmentUi();
  const button = fakeButton();
  let deleted = 0;
  let refreshed = 0;
  let prevented = 0;
  let stopped = 0;
  ui.bindDeleteButton(button, {
    fileName: "Договор.pdf",
    confirmDelete: async () => false,
    deleteAttachment: async () => { deleted += 1; },
    refresh: async () => { refreshed += 1; },
    onError: assert.fail,
  });

  await button.click({
    preventDefault() { prevented += 1; },
    stopPropagation() { stopped += 1; },
  });
  assert.equal(prevented, 1);
  assert.equal(stopped, 1);
  assert.equal(deleted, 0);
  assert.equal(refreshed, 0);
  assert.equal(button.disabled, false);
});

test("confirmed attachment deletion sends one request and refreshes list", async () => {
  const ui = loadAttachmentUi();
  const button = fakeButton();
  let deleted = 0;
  let refreshed = 0;
  ui.bindDeleteButton(button, {
    fileName: "Здымак.png",
    confirmDelete: async () => true,
    deleteAttachment: async () => { deleted += 1; },
    refresh: async () => { refreshed += 1; },
    onError: assert.fail,
  });

  await button.click({ preventDefault() {}, stopPropagation() {} });
  assert.equal(deleted, 1);
  assert.equal(refreshed, 1);
  assert.equal(button.disabled, true);
});
