(function () {
	'use strict';
	var viewer = document.getElementById('image-viewer');
	if (!viewer || typeof viewer.showModal !== 'function') return;
	var media = document.getElementById('image-viewer-media');
	var title = document.getElementById('image-viewer-title');
	var metadata = document.getElementById('image-viewer-meta');
	var previous = viewer.querySelector('.image-viewer-prev');
	var next = viewer.querySelector('.image-viewer-next');
	var opener, group = [], index = 0;
	function stopVideo() {
		var video = media.querySelector('video');
		if (!video) return;
		video.pause();
		video.removeAttribute('src');
		video.load();
	}
	function imageSource(link, original) {
		var still = link.querySelector('source[media="(prefers-reduced-motion: reduce)"]');
		if (still && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return still.srcset;
		return link.dataset.fullSrc || link.href || original.dataset.original || original.src;
	}
	function render(link) {
		stopVideo();
		var isVideo = link.classList.contains('conference-video');
		var figure;
		if (isVideo) {
			figure = document.createElement('video');
			figure.src = link.href;
			figure.poster = link.dataset.poster;
			figure.controls = true;
			figure.defaultMuted = true;
			figure.muted = true;
			figure.playsInline = true;
			figure.preload = 'metadata';
			figure.setAttribute('aria-label', link.dataset.title);
			var fallback = document.createElement('a');
			fallback.href = link.href;
			fallback.textContent = 'Open the presentation video';
			figure.appendChild(fallback);
		} else {
			var original = link.querySelector('.image-stack') || link.querySelector('img');
			figure = original.cloneNode(true);
			if (figure.tagName === 'IMG') { figure.removeAttribute('srcset'); figure.removeAttribute('sizes'); figure.src = imageSource(link, original); }
			var images = figure.tagName === 'IMG' ? [figure] : figure.querySelectorAll('img');
			images.forEach(function (img) {
                if (figure.tagName !== 'IMG' && img.dataset.original) img.src = img.dataset.original;
                img.loading = 'eager'; img.decoding = 'async';
                img.addEventListener('error', function () {
                    var message = document.createElement('a');
                    message.href = link.href; message.textContent = 'Image unavailable. Open original';
                    img.replaceWith(message);
                }, { once: true });
            });
		}
		media.replaceChildren(figure);
		var publication = link.closest('.publication');
		if (publication) {
			title.textContent = publication.querySelector('h3').textContent;
			metadata.replaceChildren(publication.querySelector('.venue').cloneNode(true), publication.querySelector('.author-badge').cloneNode(true));
		} else {
			title.textContent = link.dataset.title;
			var eventTag = document.createElement('span');
			eventTag.className = 'venue';
			eventTag.textContent = link.dataset.event;
			var location = document.createElement('span');
			location.textContent = link.dataset.location;
			metadata.replaceChildren();
			if (link.dataset.event) metadata.appendChild(eventTag);
			if (link.dataset.location) metadata.appendChild(location);
		}
		media.setAttribute('aria-label', isVideo ? 'Conference presentation video' : 'Enlarged image');
		previous.hidden = next.hidden = group.length < 2;
		media.scrollTop = media.scrollLeft = 0;
		if (media.animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) media.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 180 });
		if (isVideo) figure.play().catch(function () { /* Native controls remain available. */ });
	}
	function move(direction) {
		if (group.length < 2) return;
		index = (index + direction + group.length) % group.length;
		render(group[index]);
	}
	document.querySelectorAll('.publication-image, .conference-photo, .conference-video, .maker-image').forEach(function (link) {
		link.setAttribute('aria-haspopup', 'dialog');
		link.setAttribute('aria-controls', 'image-viewer');
		link.addEventListener('click', function (event) {
			if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.defaultPrevented) return;
			event.preventDefault();
			opener = link;
			var container = link.closest('.project-gallery, .conference-gallery');
			group = container ? Array.from(container.querySelectorAll('.publication-image, .conference-photo, .conference-video, .maker-image')) : [link];
			index = group.indexOf(link);
			render(link);
			viewer.showModal();
			document.body.classList.add('image-viewer-open');
			viewer.dispatchEvent(new Event('vieweropen'));
		});
	});
	previous.addEventListener('click', function () { move(-1); });
	next.addEventListener('click', function () { move(1); });
	viewer.addEventListener('keydown', function (event) {
		if (event.target.tagName === 'VIDEO' || event.target.tagName === 'INPUT') return;
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
		event.preventDefault();
		move(event.key === 'ArrowRight' ? 1 : -1);
	});
	viewer.querySelector('.image-viewer-close').addEventListener('click', function () { viewer.close(); });
	viewer.addEventListener('click', function (event) {
		if (event.target !== viewer) return;
		var bounds = viewer.getBoundingClientRect();
		if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) viewer.close();
	});
	viewer.addEventListener('close', function () {
		stopVideo();
		media.replaceChildren();
		document.body.classList.remove('image-viewer-open');
		if (opener) opener.focus({ preventScroll: true });
	});
})();

