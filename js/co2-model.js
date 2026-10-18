/* Ordered hosted GLB preload, with an immediate poster and bounded retries. */
(function () {
  'use strict';
  var viewer = document.getElementById('co2-model');
  if (!viewer) return;
  var panel = viewer.closest('.model-panel');
  var progress = viewer.querySelector('.model-loading');
  var reset = panel.querySelector('.model-reset');
  var retry = panel.querySelector('.model-retry');
  var fallback = viewer.querySelector('.model-fallback');
  var base = document.currentScript.src, attempt = 0, library;
  function loadLibrary() {
    if (library) return library;
    library = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      var timeout = setTimeout(function () { script.remove(); library = null; reject(new Error('Viewer timeout')); }, 20000);
      script.src = new URL('model-viewer.umd.js?v=4.4.0', base).href;
      script.onload = function () { clearTimeout(timeout); resolve(); };
      script.onerror = function () { clearTimeout(timeout); script.remove(); library = null; reject(new Error('Viewer unavailable')); };
      document.head.appendChild(script);
    });
    return library;
  }
  function run() {
    return new Promise(function (resolve) {
      panel.classList.remove('model-unavailable');
      panel.dataset.modelState = 'loading';
      fallback.hidden = true; reset.hidden = false; reset.disabled = true; retry.hidden = true;
      progress.hidden = false; progress.textContent = 'Loading 3D model…';
      var done = false;
      function finish(ok) {
        if (done) return; done = true; clearTimeout(timeout);
        viewer.removeEventListener('load', loaded); viewer.removeEventListener('error', failed);
        viewer.removeEventListener('progress', update);
        progress.hidden = true;
        panel.classList.toggle('model-unavailable', !ok);
        fallback.hidden = ok; reset.hidden = !ok; reset.disabled = !ok; retry.hidden = ok;
        panel.dataset.modelState = ok ? 'ready' : 'unavailable';
        if (!ok) viewer.removeAttribute('src');
        resolve(ok);
      }
      function loaded() { viewer.cameraOrbit = '25deg 35deg 0.095m'; finish(true); }
      function failed() { finish(false); }
      function update(event) { progress.textContent = 'Loading 3D model… ' + Math.round(event.detail.totalProgress * 100) + '%'; }
      var timeout = setTimeout(failed, 45000);
      viewer.addEventListener('load', loaded); viewer.addEventListener('error', failed); viewer.addEventListener('progress', update);
      if (location.protocol === 'file:' || !window.customElements) { failed(); return; }
      loadLibrary().then(function () { return customElements.whenDefined('model-viewer'); }).then(function () {
        if (done) return;
        viewer.setAttribute('loading', 'eager');
        viewer.setAttribute('src', new URL('../models/co2-sensor.glb', base).href + (attempt > 1 ? '?retry=' + attempt : ''));
      }).catch(failed);
    });
  }
  function start(priority) {
    attempt++;
    if (window.SiteLoading) return SiteLoading.enqueue('co2-model-' + attempt, priority, run);
    return run();
  }
  retry.addEventListener('click', function () { retry.hidden = true; start(0); });
  reset.addEventListener('click', function () {
    viewer.cameraOrbit = '25deg 35deg 0.095m'; viewer.cameraTarget = 'auto auto auto'; viewer.fieldOfView = '30deg';
  });
  start(20);
})();
