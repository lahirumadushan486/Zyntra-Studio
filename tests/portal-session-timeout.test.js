'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

let now = 1_000_000;
let timerId = 0;
const storage = new Map();
const listeners = {};
const documentListeners = {};
const localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); }
};
const document = {
  hidden: false,
  body: { appendChild() {} },
  getElementById() { return null; },
  createElement() { return { setAttribute() {}, addEventListener() {}, append() {}, focus() {}, remove() {}, className: '', textContent: '', id: '' }; },
  addEventListener(type, callback) { documentListeners[type] = callback; }
};
const supabase = {
  auth: {
    async getSession() { return { data: { session: { user: { id: 'test-user' }, access_token: 'sdk-managed' } }, error: null }; },
    async signOut() { return { error: null }; }
  },
  removeAllChannels() {}
};
const window = {
  document,
  localStorage,
  Date: { now: () => now },
  setTimeout(callback, delay) { timerId += 1; listeners['timer-' + timerId] = { callback, delay }; return timerId; },
  clearTimeout(id) { delete listeners['timer-' + id]; },
  addEventListener(type, callback) { listeners[type] = callback; },
  location: { replace() {} }
};
window.window = window;

const source = fs.readFileSync('js/portal-session-timeout.js', 'utf8');
vm.runInNewContext(source, { window, document, BroadcastChannel: undefined, Date: window.Date });

async function run() {
  const portal = window.ZyntraPortalSession;
  assert.equal(portal.PORTAL_SESSION_DURATION_MS, 900_000);
  assert.equal(portal.startPortalSessionTimeout({ supabase, role: 'admin', newSession: true }), true);
  assert.equal(Number(localStorage.getItem('zyntra_portal_expires_at')), 1_900_000);
  assert.equal(Object.values(listeners).some((entry) => entry && entry.delay === 840_000), true, 'warning must be scheduled at minute 14');
  assert.equal(Object.values(listeners).some((entry) => entry && entry.delay === 900_000), true, 'logout must be scheduled at minute 15');

  now = 1_600_000;
  portal.startPortalSessionTimeout({ supabase, role: 'admin', newSession: false });
  assert.equal(Number(localStorage.getItem('zyntra_portal_expires_at')), 1_900_000, 'refresh/navigation must not extend expiry');

  const session = await portal.validatePortalSession({ supabase, role: 'admin' });
  assert.equal(session.user.id, 'test-user');
  assert.equal(Number(localStorage.getItem('zyntra_portal_expires_at')), 1_900_000, 'validation must not extend expiry');
  assert.equal([...storage.keys()].some((key) => /token|password/i.test(key)), false);

  portal.clearPortalSessionTimeout({ broadcast: false });
  assert.equal(localStorage.getItem('zyntra_portal_expires_at'), null);
  console.log('Portal session timeout tests: PASS');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
