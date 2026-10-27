/* Immediate preview dialogs; full media is shared with the preemptible loader. */
(function () {
  'use strict';
  var viewer = document.getElementById('image-viewer'), loading = window.SiteLoading;
  if (!viewer || typeof viewer.showModal !== 'function' || !loading) return;
  var media = document.getElementById('image-viewer-media');
  var title = document.getElementById('image-viewer-title'), metadata = document.getElementById('image-viewer-meta');
  var previous = viewer.querySelector('.image-viewer-prev'), next = viewer.querySelector('.image-viewer-next');
  var feedback = viewer.querySelector('.image-viewer-loading'), message = feedback.querySelector('[role="status"]');
  var retry = feedback.querySelector('button');
  var opener, group = [], index = 0, generation = 0;
  var owner = 'media-dialog';
  function stopVideo() {
    var video = media.querySelector('video');
    if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
  }
  function imageSource(link, original) {
    var still = link.querySelector('source[media="(prefers-reduced-motion: reduce)"]');
    if (still && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return still.srcset;
    return link.dataset.fullSrc || link.href || original.dataset.original || original.src;
  }
  function preview(original) {
    var img = original.cloneNode(true);
    img.removeAttribute('srcset'); img.removeAttribute('sizes'); img.removeAttribute('data-src');
    img.src = original.currentSrc || original.src;
    img.loading = 'eager'; img.decoding = 'async';
    return img;
  }
  function showFeedback(text, failed) {
    feedback.hidden = false; message.textContent = text; retry.hidden = !failed;
    media.setAttribute('aria-busy', failed ? 'false' : 'true');
  }
  function render(link) {
    var turn = ++generation;
    stopVideo();
    var isVideo = link.classList.contains('conference-video');
    var original = link.querySelector('img'), stack = link.querySelector('.image-stack');
    var figure, requests = [], targets = [];
    if (stack) {
      figure = document.createElement('div'); figure.className = 'image-stack';
      stack.querySelectorAll('img').forEach(function (source) {
        var img = preview(source);
        figure.appendChild(img); targets.push(img);
        requests.push({ url: source.dataset.original || source.src, kind: 'image' });
      });
    } else {
      figure = preview(original);
      requests.push({ url: isVideo ? link.href : imageSource(link, original), kind: isVideo ? 'video' : 'image' });
      targets.push(figure);
    }
    media.replaceChildren(figure);
    var publication = link.closest('.publication');
    if (publication) {
      title.textContent = publication.querySelector('h3').textContent;
      metadata.replaceChildren(publication.querySelector('.venue').cloneNode(true), publication.querySelector('.author-badge').cloneNode(true));
    } else {
      title.textContent = link.dataset.title;
      metadata.replaceChildren();
      if (link.dataset.event) {
        var tag = document.createElement('span'); tag.className = 'venue'; tag.textContent = link.dataset.event; metadata.appendChild(tag);
      }
      if (link.dataset.location) {
        var location = document.createElement('span'); location.textContent = link.dataset.location; metadata.appendChild(location);
      }
    }
    media.setAttribute('aria-label', isVideo ? link.dataset.title || 'Video' : 'Enlarged image');
    previous.hidden = next.hidden = group.length < 2;
    media.scrollTop = media.scrollLeft = 0;
    showFeedback(isVideo ? 'Loading video…' : 'Loading full image…', false);
    // Both halves of a publication request their foreground slots together.
    loading.foreground(owner, requests);
    Promise.all(requests.map(function (request) { return loading.asset(request.url, { kind: request.kind }); })).then(function (resources) {
      if (turn !== generation || !viewer.open) return;
      if (isVideo) {
        var video = document.createElement('video');
        video.poster = figure.src; video.controls = true; video.defaultMuted = true; video.muted = true;
        video.playsInline = true; video.preload = 'auto'; video.setAttribute('aria-label', link.dataset.title);
        video.addEventListener('error', function () {
          if (turn !== generation || !viewer.open) return;
          loading.invalidate(link.href); showFeedback('Video unavailable. Please retry.', true);
        });
        video.src = resources[0];
        media.replaceChildren(video);
        video.play().catch(function () { /* Native controls remain available. */ });
      } else {
        // Decode only requested full media. Keep the preview until every part is ready.
        return Promise.all(resources.map(function (resource, position) {
          return new Promise(function (resolve, reject) {
            var img = new Image(), deadline = setTimeout(function () { failed(); }, 20000);
            function failed() { clearTimeout(deadline); loading.invalidate(requests[position].url); reject(new Error('Image could not be displayed')); }
            img.onload = function () { clearTimeout(deadline); resolve(img); };
            img.onerror = failed;
            img.src = resource;
          });
        })).then(function () {
          if (turn !== generation || !viewer.open) return;
          targets.forEach(function (img, position) { img.src = resources[position]; });
        });
      }
    }).then(function () {
      if (turn !== generation || !viewer.open) return;
      feedback.hidden = true; media.setAttribute('aria-busy', 'false');
    }).catch(function () {
      if (turn === generation && viewer.open) showFeedback(isVideo ? 'Video unavailable. Please retry.' : 'Full image unavailable. Preview shown.', true);
    });
    if (media.animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) media.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 180 });
  }
  function move(direction) {
    if (group.length < 2) return;
    index = (index + direction + group.length) % group.length; render(group[index]);
  }
  document.querySelectorAll('.publication-image, .conference-photo, .conference-video, .maker-image').forEach(function (link) {
    link.setAttribute('aria-haspopup', 'dialog'); link.setAttribute('aria-controls', 'image-viewer');
    link.addEventListener('click', function (event) {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.defaultPrevented) return;
      event.preventDefault(); opener = link;
      var container = link.closest('.project-gallery, .conference-gallery');
      group = container ? Array.from(container.querySelectorAll('.publication-image, .conference-photo, .conference-video, .maker-image')).filter(function (item) { return !item.closest('[data-loop-copy]'); }) : [link];
      index = group.indexOf(link);
      viewer.showModal(); render(link);
      document.body.classList.add('image-viewer-open'); viewer.dispatchEvent(new Event('vieweropen'));
    });
  });
  retry.addEventListener('click', function () { render(group[index]); });
  previous.addEventListener('click', function () { move(-1); });
  next.addEventListener('click', function () { move(1); });
  viewer.addEventListener('keydown', function (event) {
    if (event.target.tagName === 'VIDEO' || event.target.tagName === 'INPUT') return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault(); move(event.key === 'ArrowRight' ? 1 : -1);
  });
  viewer.querySelector('.image-viewer-close').addEventListener('click', function () { viewer.close(); });
  viewer.addEventListener('click', function (event) {
    if (event.target !== viewer) return;
    var bounds = viewer.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) viewer.close();
  });
  viewer.addEventListener('close', function () {
    generation++; loading.release(owner); stopVideo(); media.replaceChildren();
    document.body.classList.remove('image-viewer-open');
    if (opener) opener.focus({ preventScroll: true });
  });
})();

