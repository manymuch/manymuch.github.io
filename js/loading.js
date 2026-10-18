/* Shared two-slot priority queue. Visibility and interaction can promote work. */
(function () {
  'use strict';
  var jobs = new Map(), active = 0, sequence = 0, started = false;
  function pump() {
    if (!started) return;
    var waiting = Array.from(jobs.values()).filter(function (job) { return job.state === 'waiting'; });
    waiting.sort(function (a, b) { return a.priority - b.priority || a.order - b.order; });
    while (active < 2 && waiting.length) {
      var job = waiting.shift();
      job.state = 'running'; active++;
      (function (item) {
        Promise.resolve().then(item.run).then(item.resolve, function () { item.resolve(false); }).finally(function () {
          item.state = 'done'; active--; pump();
        });
      })(job);
    }
  }
  function enqueue(key, priority, run) {
    var job = jobs.get(key);
    if (job) { job.priority = Math.min(priority, job.priority); pump(); return job.promise; }
    job = { priority: priority, run: run, order: sequence++, state: 'waiting' };
    job.promise = new Promise(function (resolve) { job.resolve = resolve; });
    jobs.set(key, job); pump();
    return job.promise;
  }
  function loadImage(image, priority) {
    return enqueue(image, priority, function () {
      return new Promise(function (resolve) {
        var done = false;
        function finish(ok) {
          if (done) return; done = true;
          clearTimeout(timeout);
          image.removeEventListener('load', loaded); image.removeEventListener('error', failed);
          if (ok) { image.classList.remove('media-failed'); resolve(true); }
          else {
            image.classList.add('media-failed');
            var link = image.closest('a');
            if (link) link.title = 'Preview unavailable — open original';
            resolve(false);
          }
        }
        function loaded() {
          if (image.decode) image.decode().then(function () { finish(true); }, function () { finish(image.naturalWidth > 0); });
          else finish(true);
        }
        function failed() {
          if (image.dataset.poster && !image.dataset.posterTried) {
            image.dataset.posterTried = 'true';
            var wrapper = image.closest('picture');
            if (wrapper) wrapper.querySelectorAll('source').forEach(function (source) { source.removeAttribute('srcset'); source.removeAttribute('data-srcset'); });
            image.src = image.dataset.poster;
          } else if (image.dataset.original && !image.dataset.originalTried) {
            image.dataset.originalTried = 'true';
            image.src = image.dataset.original;
          } else finish(false);
        }
        var timeout = setTimeout(function () { finish(false); }, 20000);
        image.addEventListener('load', loaded); image.addEventListener('error', failed);
        // Animated sources stay on a still poster until admitted by this queue.
        var picture = image.closest('picture');
        if (picture) image.dataset.poster = image.src;
        if (picture) picture.querySelectorAll('source[data-srcset]').forEach(function (source) {
          source.srcset = source.dataset.srcset; source.removeAttribute('data-srcset');
        });
        if (image.dataset.src) { image.src = image.dataset.src; image.removeAttribute('data-src'); }
        image.loading = 'eager'; image.fetchPriority = priority <= 0 ? 'high' : 'low';
        if (image.complete && image.naturalWidth) loaded();
      });
    });
  }
  window.SiteLoading = { enqueue: enqueue, image: loadImage };
  var images = Array.from(document.querySelectorAll('main img:not(.model-fallback img)'));
  images.forEach(function (image) {
    var slide = image.closest('.gallery-slide');
    var first = slide && slide.parentElement.firstElementChild === slide;
    var animated = image.closest('picture');
    var visible = image.getBoundingClientRect().top < window.innerHeight + 200;
    loadImage(image, visible ? 0 : first ? 10 : animated ? 40 : 30);
  });
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { loadImage(entry.target, 0); observer.unobserve(entry.target); }
      });
    }, { rootMargin: '400px' });
    images.forEach(function (image) { observer.observe(image); });
  }
  // Critical parser-loaded profile assets settle before background downloads.
  function begin() { started = true; pump(); }
  if (document.readyState === 'complete') begin();
  else window.addEventListener('load', begin, { once: true });
})();
