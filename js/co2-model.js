/* Cached hosted GLB and viewer script; the poster remains during loading/failure. */
(function () {
  'use strict';
  var viewer = document.getElementById('co2-model'), loading = window.SiteLoading;
  if (!viewer || !loading) return;
  var panel = viewer.closest('.model-panel'), progress = viewer.querySelector('.model-loading');
  var reset = panel.querySelector('.model-reset'), retry = panel.querySelector('.model-retry');
  var fallback = viewer.querySelector('.model-fallback'), generation = 0, pending = false;
  var requests = [{ url: viewer.dataset.viewerSrc, kind: 'script' }, { url: viewer.dataset.modelSrc, kind: 'model' }];
  function start(urgent) {
    if (panel.dataset.modelState === 'ready') return;
    if (urgent) loading.foreground('pcb-viewer', requests);
    if (pending) return;
    pending = true;
    var turn = ++generation, timeout;
    panel.classList.remove('model-unavailable'); panel.dataset.modelState = 'loading';
    fallback.hidden = true; reset.hidden = false; reset.disabled = true; retry.hidden = true;
    progress.hidden = false; progress.textContent = 'Preparing 3D view…';
    function finish(ok) {
      if (turn !== generation || !pending) return;
      pending = false; clearTimeout(timeout);
      viewer.removeEventListener('load', loaded); viewer.removeEventListener('error', failed); viewer.removeEventListener('progress', update);
      loading.release('pcb-viewer');
      progress.hidden = true; panel.classList.toggle('model-unavailable', !ok);
      fallback.hidden = ok; reset.hidden = !ok; reset.disabled = !ok; retry.hidden = ok;
      panel.dataset.modelState = ok ? 'ready' : 'unavailable';
      if (!ok) {
        if (viewer.hasAttribute('src')) loading.invalidate(requests[1].url);
        viewer.removeAttribute('src');
      }
    }
    function loaded() { viewer.cameraOrbit = '25deg 35deg 0.095m'; finish(true); }
    function failed() { finish(false); }
    function update(event) { progress.textContent = 'Preparing 3D view… ' + Math.round(event.detail.totalProgress * 100) + '%'; }
    if (location.protocol === 'file:' || !window.customElements) { failed(); return; }
    // Download deadlines belong to actual transfers, not time spent in the queue.
    Promise.all([loading.script(requests[0].url), loading.asset(requests[1].url, { kind: 'model' })]).then(function (resources) {
      if (turn !== generation || !pending) return;
      timeout = setTimeout(failed, 20000);
      viewer.addEventListener('load', loaded); viewer.addEventListener('error', failed); viewer.addEventListener('progress', update);
      viewer.setAttribute('loading', 'eager'); viewer.setAttribute('src', resources[1]);
    }).catch(failed);
  }
  retry.addEventListener('click', function () { start(true); });
  viewer.addEventListener('pointerdown', function () { if (panel.dataset.modelState !== 'ready') start(true); }, { passive: true });
  var dialog = document.getElementById('image-viewer');
  if (dialog) dialog.addEventListener('vieweropen', function () { loading.release('pcb-viewer'); });
  reset.addEventListener('click', function () {
    viewer.cameraOrbit = '25deg 35deg 0.095m'; viewer.cameraTarget = 'auto auto auto'; viewer.fieldOfView = '30deg';
  });
  start(false);
})();
