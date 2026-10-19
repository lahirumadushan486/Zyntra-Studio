const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const loaderPath = path.join(__dirname, "..", "assets", "js", "zyntra-loader.js");
const loaderSource = fs.readFileSync(loaderPath, "utf8");

function runLoader(options = {}) {
  const timers = [];
  const listeners = {};
  const removed = [];
  const classes = [];
  const attributes = {};
  const loader = {
    classList: {
      add(value) {
        if (options.failDuringExit) throw new Error("exit failure");
        classes.push(value);
      }
    },
    parentNode: {
      removeChild(element) {
        removed.push(element);
      }
    },
    setAttribute(name, value) {
      attributes[name] = value;
    },
    style: {}
  };

  const storage = {
    getItem() {
      if (options.storageUnavailable) throw new Error("storage unavailable");
      return options.seen ? "1" : null;
    },
    setItem() {
      if (options.storageUnavailable) throw new Error("storage unavailable");
    }
  };

  const context = {
    Date,
    Math,
    document: {
      readyState: options.readyState || "complete",
      addEventListener(name, handler) {
        listeners[name] = handler;
      },
      getElementById() {
        return loader;
      }
    },
    window: {
      clearTimeout(id) {
        if (id) id.cleared = true;
      },
      sessionStorage: storage,
      setTimeout(handler, delay) {
        const timer = { handler, delay, cleared: false };
        timers.push(timer);
        return timer;
      }
    }
  };

  const source = options.disabled
    ? loaderSource.replace("const ENABLE_ZYNTRA_PAGE_LOADER = true;", "const ENABLE_ZYNTRA_PAGE_LOADER = false;")
    : loaderSource;
  vm.runInNewContext(source, context);
  return { attributes, classes, listeners, loader, removed, timers };
}

test("first session visit exits after the minimum display period and removes the overlay", () => {
  const state = runLoader();
  const readyTimer = state.timers.find((timer) => timer.delay <= 780);
  assert.ok(readyTimer);
  readyTimer.handler();
  assert.deepEqual(state.classes, ["zyntra-loader-exit"]);
  assert.equal(state.loader.style.pointerEvents, "none");
  const exitTimer = state.timers.find((timer) => timer.delay === 380);
  assert.ok(exitTimer);
  exitTimer.handler();
  assert.equal(state.removed.length, 1);
});

test("repeat visits skip and remove the loader immediately", () => {
  const state = runLoader({ seen: true });
  assert.equal(state.removed.length, 1);
  assert.equal(state.timers.length, 0);
});

test("unavailable sessionStorage fails open", () => {
  const state = runLoader({ storageUnavailable: true });
  assert.equal(state.removed.length, 1);
  assert.equal(state.loader.style.display, "none");
});

test("the feature flag disables the loader without scheduling work", () => {
  const state = runLoader({ disabled: true });
  assert.equal(state.removed.length, 1);
  assert.equal(state.timers.length, 0);
});

test("the 1.5 second safety timer removes a loader when DOM readiness stalls", () => {
  const state = runLoader({ readyState: "loading" });
  const safetyTimer = state.timers.find((timer) => timer.delay === 1500);
  assert.ok(safetyTimer);
  safetyTimer.handler();
  assert.equal(state.removed.length, 1);
});

test("an exit animation error immediately removes the overlay", () => {
  const state = runLoader({ failDuringExit: true });
  const readyTimer = state.timers.find((timer) => timer.delay <= 780);
  readyTimer.handler();
  assert.equal(state.removed.length, 1);
  assert.equal(state.loader.style.display, "none");
});
