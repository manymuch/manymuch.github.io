/* Dependency-free logic tests: node scripts/check-runtime.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const tick = () => new Promise(resolve => setImmediate(resolve));
function queueContext(timers = {}) {
  const listeners = {};
  const context = { Map, Promise, Array, setTimeout, clearTimeout, ...timers,
    document: { readyState: 'loading', querySelectorAll: () => [] },
    window: { addEventListener: (event, callback) => { listeners[event] = callback; } }
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/loading.js'), 'utf8'), context);
  return { api: context.window.SiteLoading, start: () => listeners.load() };
}
async function testQueue() {
  const { api, start } = queueContext();
  let active = 0, max = 0;
  const order = [], releases = {};
  function job(name) { return () => new Promise(resolve => {
    order.push(name); active++; max = Math.max(max, active);
    releases[name] = () => { active--; resolve(true); };
  }); }
  const last = api.enqueue('last', 40, job('last'));
  const first = api.enqueue('first', 0, job('first'));
  const model = api.enqueue('model', 20, job('model'));
  const second = api.enqueue('second', 10, job('second'));
  assert.deepEqual(order, []);
  start(); await tick();
  assert.deepEqual(order, ['first', 'second']);
  assert.equal(api.enqueue('last', 1, job('duplicate')), last);
  releases.first(); await first; await tick();
  assert.deepEqual(order, ['first', 'second', 'last']);
  releases.second(); await second; await tick();
  releases.last(); releases.model(); await Promise.all([last, model]);
  assert.equal(max, 2);
  const failed = api.enqueue('failed', 0, () => Promise.reject(new Error('Unavailable')));
  assert.equal(await failed, false);
  assert.equal(await api.enqueue('after-failure', 0, () => true), true);
}
async function testImageFallback() {
  const { api, start } = queueContext();
  const events = {};
  const image = {
    dataset: { original: 'full.webp' }, complete: false, naturalWidth: 100,
    classList: { add() {}, remove() {} }, closest: () => null,
    addEventListener: (type, fn) => { events[type] = fn; },
    removeEventListener: type => { delete events[type]; }, decode: () => Promise.resolve()
  };
  const result = api.image(image, 0); start(); await tick();
  events.error(); assert.equal(image.src, 'full.webp');
  events.load(); assert.equal(await result, true);
}
async function testAnimationPosterFallback() {
  const { api, start } = queueContext();
  const events = {}, removed = [];
  const source = { dataset: { srcset: 'animation-preview.webp' }, removeAttribute: name => { removed.push(name); } };
  const picture = { querySelectorAll: () => [source] };
  const image = {
    src: 'poster.webp', dataset: {}, complete: false, naturalWidth: 100,
    classList: { add() {}, remove() {} }, closest: selector => selector === 'picture' ? picture : null,
    addEventListener: (type, fn) => { events[type] = fn; },
    removeEventListener: type => { delete events[type]; }, decode: () => Promise.resolve()
  };
  const result = api.image(image, 0); start(); await tick();
  assert.equal(source.srcset, 'animation-preview.webp');
  events.error(); assert.equal(image.src, 'poster.webp');
  assert.ok(removed.includes('srcset'));
  events.load(); assert.equal(await result, true);
}
async function testStalledImageDeadline() {
  let deadline;
  const { api, start } = queueContext({ setTimeout: callback => { deadline = callback; return 1; }, clearTimeout() {} });
  const image = {
    dataset: {}, complete: false, naturalWidth: 0,
    classList: { add() {}, remove() {} }, closest: () => null,
    addEventListener() {}, removeEventListener() {}
  };
  const result = api.image(image, 0); start(); await tick();
  deadline(); assert.equal(await result, false);
  assert.equal(await api.enqueue('after-stalled-image', 0, () => true), true);
}
(async () => {
  await testQueue(); await testImageFallback(); await testAnimationPosterFallback(); await testStalledImageDeadline();
  console.log('Runtime checks passed: priority, promotion, two-slot limit, failures, image/poster fallbacks, stalled-image deadline.');
})().catch(error => { console.error(error); process.exitCode = 1; });
