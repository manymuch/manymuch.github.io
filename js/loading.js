/* Preview barrier, preemptible media transfers, and a page-lifetime blob cache. */
(function () {
  'use strict';
  var jobs = new Map(), assets = new Map(), owners = new Map(), scripts = new Map();
  var sequence = 0, previewActive = 0, optionalActive = 0, started = false, previewsDone = false;
  var previewPromises = [], discarded = false;
  function absolute(url) { return new URL(url, document.baseURI).href; }
  function deferred(item) {
    item.promise = new Promise(function (resolve, reject) { item.resolve = resolve; item.reject = reject; });
    // A background failure is presented when its consumer opens the asset.
    item.promise.catch(function () {});
  }
  function record(url, kind) {
    var key = absolute(url), item = assets.get(key);
    if (!item) {
      item = { key: key, kind: kind || 'image', order: sequence++, state: 'queued', transfer: null };
      deferred(item); assets.set(key, item);
    }
    return item;
  }
  function foreground(item) {
    return Array.from(owners.values()).some(function (urls) { return urls.has(item.key); });
  }
  function cancel(item) {
    var current = item.transfer;
    if (!current) return;
    item.transfer = null; item.state = 'queued';
    clearTimeout(current.timer); current.controller.abort();
    // Preserve its shared promise and original position in page order.
  }
  function transfer(item) {
    var current = { controller: new AbortController() };
    item.transfer = current; item.state = 'downloading';
    function finish(error, blob) {
      if (item.transfer !== current || discarded) return;
      clearTimeout(current.timer); item.transfer = null;
      if (error) { item.state = 'failed'; item.reject(error); }
      else {
        item.state = 'cached';
        // Full images and animations stay compressed until displayed.
        if (item.kind === 'script') blob = new Blob([blob], { type: 'text/javascript' });
        item.resource = URL.createObjectURL(blob); item.blob = true; item.resolve(item.resource);
      }
      pump();
    }
    current.timer = setTimeout(function () {
      finish(new Error('Download timed out')); current.controller.abort();
    }, item.kind === 'model' ? 90000 : 60000);
    fetch(item.key, { signal: current.controller.signal, credentials: 'same-origin' }).then(function (response) {
      if (!response.ok) throw new Error('Download failed (' + response.status + ')');
      return response.blob();
    }).then(function (blob) { finish(null, blob); }, function (error) { finish(error); });
  }
  function runJob(job, preview) {
    job.state = 'running';
    if (preview) previewActive++; else optionalActive++;
    Promise.resolve().then(job.run).then(job.resolve, function () { job.resolve(false); }).finally(function () {
      job.state = 'done';
      if (preview) previewActive--; else optionalActive--;
      pump();
    });
  }
  function pump() {
    if (!started || discarded) return;
    var items = Array.from(assets.values());
    var urgent = items.filter(function (item) { return foreground(item) && (item.state === 'queued' || item.state === 'downloading'); });
    // Promoting the same transfer leaves it running; unrelated background work stops.
    items.forEach(function (item) {
      if (item.transfer && !foreground(item) && (urgent.length || item.transfer.wasForeground)) cancel(item);
    });
    var running = items.filter(function (item) { return item.transfer; });
    if (urgent.length) {
      urgent.filter(function (item) { return item.state === 'queued'; }).slice(0, Math.max(0, 2 - running.length)).forEach(transfer);
      items.forEach(function (item) { if (item.transfer && foreground(item)) item.transfer.wasForeground = true; });
    } else if (previewsDone && !running.length) {
      var next = items.find(function (item) { return item.state === 'queued'; });
      if (next) transfer(next);
    }
    var waiting = Array.from(jobs.values()).filter(function (job) { return job.state === 'waiting'; });
    waiting.sort(function (a, b) { return a.priority - b.priority || a.order - b.order; });
    waiting.filter(function (job) { return job.preview; }).slice(0, Math.max(0, 2 - previewActive)).forEach(function (job) { runJob(job, true); });
    // Optional statistics run only after pending media.
    if (previewsDone && !urgent.length && !items.some(function (item) { return item.state === 'queued' || item.transfer; })) {
      waiting.filter(function (job) { return !job.preview; }).slice(0, Math.max(0, 2 - optionalActive)).forEach(function (job) { runJob(job, false); });
    }
  }
  function enqueue(key, priority, run, preview) {
    var job = jobs.get(key);
    if (job) { job.priority = Math.min(priority, job.priority); pump(); return job.promise; }
    job = { priority: priority, run: run, preview: !!preview, order: sequence++, state: 'waiting' };
    job.promise = new Promise(function (resolve) { job.resolve = resolve; });
    jobs.set(key, job); pump(); return job.promise;
  }
  function asset(url, options) {
    options = options || {};
    var item = record(url, options.kind);
    if (item.state === 'failed') { deferred(item); item.state = 'queued'; }
    if (options.foreground) {
      var owner = options.owner || 'interaction', urls = owners.get(owner) || new Set();
      urls.add(item.key); owners.set(owner, urls);
    }
    pump(); return item.promise;
  }
  function scope(owner, requests) {
    // Replace all requests for a popup atomically, including two-part figures.
    var urls = new Set();
    requests.forEach(function (request) {
      var item = record(request.url, request.kind);
      if (item.state === 'failed') { deferred(item); item.state = 'queued'; }
      urls.add(item.key);
    });
    owners.set(owner, urls); pump();
  }
  function release(owner) { owners.delete(owner); pump(); }
  function invalidate(url) {
    var item = assets.get(absolute(url));
    if (!item || item.state !== 'cached') return;
    if (item.blob) URL.revokeObjectURL(item.resource);
    item.blob = false; item.resource = null; item.state = 'failed';
  }
  function script(url) {
    var key = absolute(url);
    if (!scripts.has(key)) {
      var promise = asset(key, { kind: 'script' }).then(function (resource) {
        return new Promise(function (resolve, reject) {
          var element = document.createElement('script');
          var deadline = setTimeout(function () { element.remove(); reject(new Error('Viewer initialization timed out')); }, 20000);
          element.src = resource;
          element.onload = function () { clearTimeout(deadline); resolve(); };
          element.onerror = function () { clearTimeout(deadline); element.remove(); invalidate(key); reject(new Error('Viewer unavailable')); };
          document.head.appendChild(element);
        });
      });
      scripts.set(key, promise);
      promise.catch(function () { scripts.delete(key); });
    }
    return scripts.get(key);
  }
  function rememberPreview(url) {
    if (!url) return;
    var item = record(url);
    if (item.state === 'cached') return;
    if (item.transfer) cancel(item);
    if (item.state === 'failed') deferred(item);
    // Already loaded by the browser: reuse its URL without fetching again.
    item.state = 'cached'; item.resource = item.key; item.resolve(item.resource);
  }
  function image(image, priority) {
    if (priority <= 0) image.fetchPriority = 'high';
    return enqueue(image, priority, function () {
      return new Promise(function (resolve) {
        var done = false;
        function finish(ok) {
          if (done) return; done = true; clearTimeout(timeout);
          image.removeEventListener('load', loaded); image.removeEventListener('error', failed);
          image.classList.toggle('media-failed', !ok);
          if (ok) rememberPreview(image.currentSrc || image.src);
          else { var link = image.closest('a'); if (link) link.title = 'Preview unavailable — open original'; }
          resolve(ok);
        }
        function loaded() {
          if (image.decode) image.decode().then(function () { finish(true); }, function () { finish(image.naturalWidth > 0); });
          else finish(true);
        }
        function failed() {
          if (image.dataset.poster && !image.dataset.posterTried) {
            image.dataset.posterTried = 'true';
            var picture = image.closest('picture');
            if (picture) picture.querySelectorAll('source').forEach(function (source) { source.removeAttribute('srcset'); source.removeAttribute('data-srcset'); });
            image.src = image.dataset.poster;
          } else finish(false);
        }
        var timeout = setTimeout(function () { finish(false); }, 20000);
        image.addEventListener('load', loaded); image.addEventListener('error', failed);
        var picture = image.closest('picture');
        if (picture) {
          image.dataset.poster = image.src;
          if (image.complete && image.naturalWidth) rememberPreview(image.currentSrc || image.src);
          picture.querySelectorAll('source[data-srcset]').forEach(function (source) { source.srcset = source.dataset.srcset; source.removeAttribute('data-srcset'); });
        }
        if (image.dataset.src) { image.src = image.dataset.src; image.removeAttribute('data-src'); }
        image.loading = 'eager'; image.fetchPriority = jobs.get(image).priority <= 0 ? 'high' : 'low';
        // Picture source selection is asynchronous: the old poster may still report complete.
        if (picture) setTimeout(function () { if (!done && image.complete && image.naturalWidth) loaded(); }, 0);
        else if (image.complete && image.naturalWidth) loaded();
      });
    }, true);
  }
  window.SiteLoading = { enqueue: enqueue, image: image, asset: asset, foreground: scope, release: release, script: script, invalidate: invalidate };
  // DOM order is stable even when an interrupted download has to restart.
  document.querySelectorAll('.publication-image, .conference-photo, .conference-video, .maker-image, model-viewer').forEach(function (node) {
    if (node.tagName === 'MODEL-VIEWER') {
      record(node.dataset.viewerSrc, 'script'); record(node.dataset.modelSrc, 'model');
    } else if (node.classList.contains('conference-video')) {
      if (node.dataset.poster) record(node.dataset.poster, 'image');
      record(node.href, 'video');
    } else {
      var stack = node.querySelector('.image-stack');
      if (stack) stack.querySelectorAll('img').forEach(function (img) { record(img.dataset.original || img.src, 'image'); });
      else record(node.dataset.fullSrc || node.href, 'image');
    }
  });
  var images = Array.from(document.querySelectorAll('img'));
  images.forEach(function (img) {
    var slide = img.closest('.gallery-slide');
    var first = slide && slide.parentElement.firstElementChild === slide;
    var visible = img.getBoundingClientRect().top < window.innerHeight + 200;
    previewPromises.push(image(img, visible ? 0 : first ? 10 : img.closest('picture') ? 40 : 30));
  });
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { if (entry.isIntersecting) { image(entry.target, 0); observer.unobserve(entry.target); } });
    }, { rootMargin: '400px' });
    images.forEach(function (img) { observer.observe(img); });
  }
  Promise.all(previewPromises).then(function () { previewsDone = true; pump(); });
  started = true; pump();
  window.addEventListener('pagehide', function (event) {
    if (event.persisted) return;
    discarded = true;
    assets.forEach(function (item) { cancel(item); if (item.blob) URL.revokeObjectURL(item.resource); });
  });
})();
