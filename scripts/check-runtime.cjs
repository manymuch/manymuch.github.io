/* Dependency-free scheduler/navigation regression checks. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const tick = async () => { for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve)); };
function image(src = 'preview.webp', top = 0) {
  const events = {};
  return {
    src, dataset: {}, complete: false, naturalWidth: 100,
    classList: { toggle() {} }, closest: () => null,
    getBoundingClientRect: () => ({ top }),
    addEventListener: (type, fn) => { events[type] = fn; },
    removeEventListener: type => { delete events[type]; },
    removeAttribute() {}, decode: () => Promise.resolve(),
    loaded() { this.currentSrc = this.src; events.load(); },
    failed() { events.error(); }
  };
}
function media(url) {
  return { tagName: 'A', href: url, dataset: {}, classList: { contains: () => false }, querySelector: () => null };
}
function harness(images = [], manifest = []) {
  const events = {}, transfers = [], timers = new Map(), revoked = [], executions = [];
  let timerID = 0, blobID = 0;
  class ResourceURL extends URL {
    static createObjectURL() { return 'blob:cached-' + (++blobID); }
    static revokeObjectURL(url) { revoked.push(url); }
  }
  const context = { Map, Set, Promise, Array, URL: ResourceURL, Blob, AbortController,
    setTimeout(fn, ms) { const id = ++timerID; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    fetch(url, options) {
      return new Promise((resolve, reject) => {
        const request = { url, signal: options.signal, finish(status = 200) { resolve({ ok: status === 200, status, blob: () => Promise.resolve(new Blob(['compressed'])) }); } };
        options.signal.addEventListener('abort', () => { request.aborted = true; reject(new Error('Aborted')); });
        transfers.push(request);
      });
    },
    document: { baseURI: 'http://site.test/',
      querySelectorAll: selector => selector === 'img' ? images : manifest,
      createElement: () => ({ remove() {} }),
      head: { appendChild(element) { executions.push(element.src); element.onload(); } }
    },
    window: { innerHeight: 800, addEventListener(event, callback) { events[event] = callback; } }
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/loading.js'), 'utf8'), context);
  return { api: context.window.SiteLoading, transfers, timers, revoked, executions, events,
    deadline(ms) { const entry = [...timers].find(([, item]) => item.ms === ms); assert.ok(entry, 'Expected deadline ' + ms); timers.delete(entry[0]); entry[1].fn(); },
    paths() { return transfers.map(item => new URL(item.url).pathname); }
  };
}
async function previewBarrier() {
  const a = image('one.webp'), b = image('broken.webp'), c = image('stalled.webp');
  const h = harness([a, b, c], [media('full-one.webp'), media('one.webp'), media('full-two.webp')]);
  await tick(); assert.equal(h.transfers.length, 0);
  a.loaded(); await tick(); assert.equal(h.transfers.length, 0);
  b.failed(); await tick(); assert.equal(h.transfers.length, 0);
  h.deadline(20000); await tick(); assert.deepEqual(h.paths(), ['/full-one.webp']);
  h.transfers[0].finish(); await tick(); assert.deepEqual(h.paths(), ['/full-one.webp', '/full-two.webp']);
  h.transfers[1].finish(); await tick();
  assert.equal(await h.api.asset('one.webp'), 'http://site.test/one.webp');
  assert.equal(h.transfers.length, 2, 'Previews must not be fetched twice');
}
async function previewPriorityAndFallback() {
  const near = image('near.webp'), far = image('far.webp', 5000), last = image('last.webp', 7000);
  const h = harness([far, last, near]); await tick();
  assert.equal(near.fetchPriority, 'high'); assert.equal(far.fetchPriority, 'low'); assert.equal(last.fetchPriority, undefined);
  h.api.image(last, 0); near.loaded(); await tick(); assert.equal(last.fetchPriority, 'high');
  far.failed(); last.loaded(); await tick();
  const poster = image('poster.webp'), removed = [];
  const source = { dataset: { srcset: 'motion.webp' }, removeAttribute: name => removed.push(name) };
  poster.closest = selector => selector === 'picture' ? { querySelectorAll: () => [source] } : null;
  const result = h.api.image(poster, 0); await tick();
  assert.equal(source.srcset, 'motion.webp'); poster.failed(); assert.equal(poster.src, 'poster.webp');
  assert.ok(removed.includes('srcset')); poster.loaded(); assert.equal(await result, true);
}
async function previewCacheRace() {
  const img = image('shared.webp'), h = harness([img], [media('shared.webp')]); await tick();
  const opened = h.api.asset('shared.webp', { foreground: true });
  img.loaded(); assert.equal(await opened, 'http://site.test/shared.webp'); await tick();
  assert.equal(h.transfers[0].aborted, true); assert.equal(h.transfers.length, 1);
  const late = image('late.webp'), failed = harness([late], [media('late.webp')]); await tick();
  const first = failed.api.asset('late.webp', { foreground: true }); failed.transfers[0].finish(503);
  await assert.rejects(first); late.loaded(); await tick();
  assert.equal(await failed.api.asset('late.webp'), 'http://site.test/late.webp');
}
async function priorityAndComposites() {
  const h = harness([], ['a', 'b', 'c', 'd'].map(media)); await tick();
  const original = h.api.asset('/a');
  h.api.foreground('popup', [{ url: 'b' }, { url: 'c' }]); await tick();
  assert.equal(h.transfers[0].aborted, true);
  assert.deepEqual(h.paths(), ['/a', '/b', '/c']);
  const b = h.api.asset('b'); h.transfers[1].finish(); await b; await tick();
  assert.equal(h.transfers.length, 3, 'Background waits for both composite halves');
  h.transfers[2].finish(); await tick();
  assert.deepEqual(h.paths(), ['/a', '/b', '/c', '/a'], 'Resume original order while popup stays open');
  assert.equal(h.api.asset('/a'), original, 'Cancellation preserves shared promise');
  assert.equal(h.api.asset('http://site.test/b'), b);
  h.transfers[3].finish(); await original; await tick();
  assert.deepEqual(h.paths(), ['/a', '/b', '/c', '/a', '/d']);
  h.transfers[4].finish(); await tick();
}
async function promotionAndRapidSwitch() {
  const h = harness([], ['a', 'b', 'c'].map(media)); await tick();
  const a = h.api.asset('a'); h.api.foreground('popup', [{ url: 'a' }]); await tick();
  assert.equal(h.transfers.length, 1); assert.ok(!h.transfers[0].aborted);
  h.api.foreground('popup', [{ url: 'c' }]); await tick(); assert.equal(h.transfers[0].aborted, true);
  const c = h.api.asset('c'); h.api.foreground('popup', [{ url: 'b' }]); await tick();
  assert.equal(h.transfers[1].aborted, true);
  h.transfers[1].finish(); await tick(); assert.equal(h.transfers.length, 3, 'Stale completion cannot unlock background');
  h.transfers[2].finish(); await tick(); assert.deepEqual(h.paths(), ['/a', '/c', '/b', '/a']);
  h.api.release('popup'); h.transfers[3].finish(); await a; await tick();
  h.transfers[4].finish(); await c; await tick();
  const close = harness([], ['a', 'b', 'c'].map(media)); await tick();
  close.api.foreground('popup', [{ url: 'c' }]); await tick(); close.api.release('popup'); await tick();
  assert.equal(close.transfers[1].aborted, true); assert.deepEqual(close.paths(), ['/a', '/c', '/a']);
}
async function failureRetryAndDeadlines() {
  const h = harness([], ['bad', 'next'].map(media)); await tick();
  const failure = h.api.asset('bad'); h.transfers[0].finish(404); await assert.rejects(failure); await tick();
  assert.deepEqual(h.paths(), ['/bad', '/next']);
  h.api.foreground('popup', [{ url: 'bad' }]); const retry = h.api.asset('bad');
  assert.notEqual(retry, failure); assert.equal(h.transfers[1].aborted, true);
  h.transfers[2].finish(); assert.match(await retry, /^blob:/); await tick();
  h.transfers[3].finish(); await tick();
  const m = harness(); await tick();
  const model = m.api.asset('model.glb', { kind: 'model' });
  const later = m.api.asset('later.webp');
  assert.equal([...m.timers.values()].filter(item => item.ms === 90000).length, 1);
  assert.equal([...m.timers.values()].filter(item => item.ms === 60000).length, 0, 'Queued work has no deadline yet');
  m.deadline(90000); await assert.rejects(model, /timed out/); await tick();
  assert.equal(m.transfers[0].aborted, true); m.deadline(60000); await assert.rejects(later, /timed out/);
  const again = m.api.asset('later.webp', { foreground: true }); m.transfers[2].finish(); await again;
}
async function cacheScriptsQueriesAndLifetime() {
  const h = harness(); await tick();
  const a = h.api.asset('photo.webp?size=1');
  assert.equal(h.api.asset('http://site.test/photo.webp?size=1'), a);
  const b = h.api.asset('photo.webp?size=2'); assert.notEqual(a, b);
  h.transfers[0].finish(); await a; await tick(); h.transfers[1].finish(); await b; await tick();
  const model = h.api.asset('model.glb', { kind: 'model' }); h.transfers[2].finish(); const blob = await model; await tick();
  assert.equal(await h.api.asset('/model.glb'), blob); assert.equal(h.transfers.length, 3);
  const script = h.api.script('viewer.js?v=1'); assert.equal(h.api.script('viewer.js?v=1'), script);
  h.transfers[3].finish(); await script; await h.api.script('viewer.js?v=1'); assert.equal(h.executions.length, 1);
  h.events.pagehide({ persisted: true }); assert.equal(h.revoked.length, 0);
  assert.equal(await h.api.asset('model.glb'), blob);
  h.events.pagehide({ persisted: false }); assert.equal(h.revoked.length, 4);
  const bad = harness(); await tick();
  const corrupt = bad.api.asset('corrupt.webp'); bad.transfers[0].finish(); await corrupt;
  bad.api.invalidate('corrupt.webp');
  const fresh = bad.api.asset('corrupt.webp', { foreground: true }); assert.notEqual(corrupt, fresh);
  bad.transfers[1].finish(); await fresh; assert.equal(bad.revoked.length, 1);
}
async function optionalWork() {
  const preview = image(); const h = harness([preview], [media('full')]);
  const order = [];
  const optional = h.api.enqueue('stats', 50, () => { order.push('stats'); return true; });
  assert.equal(h.api.enqueue('stats', 0, () => false), optional);
  await tick(); assert.deepEqual(order, []); preview.loaded(); await tick(); assert.deepEqual(order, []);
  h.transfers[0].finish(); assert.equal(await optional, true);
  assert.equal(await h.api.enqueue('failed-api', 50, () => Promise.reject(new Error())), false);
  assert.equal(await h.api.enqueue('next-api', 50, () => true), true);
}
function navigation() {
  const aliases = { one: 'employment', two: 'education', three: 'publications', building: 'personal-projects' };
  const canonical = ['employment', 'education', 'publications', 'community', 'personal-projects'];
  for (const hash of [...canonical, ...Object.keys(aliases)]) {
    const events = {}, changes = [], scrolls = [], active = {};
    const location = { hash: '#' + hash, pathname: '/', search: '?test=1' };
    const sections = Object.fromEntries(canonical.map((id, index) => [id, { id, getBoundingClientRect: () => ({ top: index * 800 }), scrollIntoView: () => scrolls.push(id) }]));
    const links = canonical.map(id => ({ hash: '#' + id, classList: { toggle: (_, value) => { active[id] = value; } }, setAttribute() {}, removeAttribute() {} }));
    const state = { preserve: true };
    const context = { Array, location, history: { state, replaceState(s, unused, url) { assert.equal(s, state); changes.push(url); location.hash = url.slice(url.indexOf('#')); } },
      requestAnimationFrame: fn => fn(), document: { getElementById: id => sections[id], querySelectorAll: () => links, documentElement: { scrollHeight: 10000 } },
      window: { innerHeight: 800, scrollY: 0, addEventListener: (name, fn) => { events[name] = fn; } }
    };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'js/navigation.js'), 'utf8'), context);
    assert.equal(location.hash, '#' + (aliases[hash] || hash));
    assert.equal(changes.length, aliases[hash] ? 1 : 0);
    if (aliases[hash]) assert.deepEqual(changes, ['/?test=1#' + aliases[hash]]);
    location.hash = '#education'; events.hashchange(); assert.equal(changes.length, aliases[hash] ? 1 : 0, 'Back/Forward adds no history entries');
    location.hash = '#three'; events.hashchange(); assert.equal(location.hash, '#publications');
    location.hash = '#unknown'; events.hashchange();
    sections.employment.getBoundingClientRect = () => ({ top: -800 }); sections.education.getBoundingClientRect = () => ({ top: 0 });
    events.scroll(); assert.equal(active.education, true);
  }
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const [old, id] of Object.entries(aliases)) {
    assert.match(html, new RegExp('<span id="' + old + '" class="section-alias" aria-hidden="true"></span>\\s*<section id="' + id + '"'));
    assert.ok(html.includes('href="#' + id + '"'));
  }
  console.log('Navigation: canonical/legacy links, native aliases, query/state preservation, history normalization, section tracking.');
}
(async () => {
  await previewBarrier(); await previewPriorityAndFallback(); await previewCacheRace(); await priorityAndComposites(); await promotionAndRapidSwitch();
  await failureRetryAndDeadlines(); await cacheScriptsQueriesAndLifetime(); await optionalWork(); navigation();
  console.log('Loading: preview barrier/priority/failure/deadline, sequential background, two foreground slots, promotion, interruption/resumption, rapid switches/close, retry, URL deduplication, blob/script reuse, BFCache lifetime, optional API isolation.');
})().catch(error => { console.error(error); process.exitCode = 1; });
