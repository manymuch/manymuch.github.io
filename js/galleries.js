(function () {
	'use strict';
	if (!window.EmblaCarousel) return;
	var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
	document.querySelectorAll('[data-carousel]').forEach(function (gallery) {
		var slides = Array.from(gallery.querySelector('.gallery-track').children);
		if (slides.length < 2) return;
		// Short galleries need a repeated set so Embla can loop without reversing.
		if (gallery.classList.contains('microduck-gallery')) {
			var track = gallery.querySelector('.gallery-track');
			slides.forEach(function (slide) {
				var copy = slide.cloneNode(true);
				copy.dataset.loopCopy = '';
				copy.querySelectorAll('a').forEach(function (link, index) {
					link.addEventListener('click', function (event) {
						if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
						event.preventDefault();
						slide.querySelectorAll('a')[index].click();
					});
				});
				track.appendChild(copy);
			});
			slides = Array.from(track.children);
		}
		var api = window.EmblaCarousel(gallery.querySelector('.gallery-window'), {
			loop: true, align: 'start', duration: 24, skipSnaps: true, inViewThreshold: 0.2,
			watchDrag: function (_, event) { return !event.target.closest('model-viewer, .model-reset, video'); }
		});
		gallery.classList.add('gallery-enhanced');
		var timer, inView = false, hovered = false, dragging = false;
		var viewer = document.getElementById('image-viewer');
		function button(className, label, text) {
			var control = document.createElement('button');
			control.type = 'button';
			control.className = className;
			control.setAttribute('aria-label', label);
			control.textContent = text || '';
			return control;
		}
		function arrow(className, label, path) {
			var control = button(className, label);
			control.innerHTML = '<svg viewBox="0 0 24 36" aria-hidden="true"><path d="' + path + '"/></svg>';
			return control;
		}
		var previous = arrow('gallery-arrow gallery-prev', 'Previous project images', 'M17 5 6 18l11 13');
		var next = arrow('gallery-arrow gallery-next', 'Next project images', 'm7 5 11 13L7 31');
		gallery.append(previous, next);
		function advance(forward) {
			if (forward && api.canScrollNext()) api.scrollNext(reducedMotion.matches);
			else if (!forward && api.canScrollPrev()) api.scrollPrev(reducedMotion.matches);
			else api.scrollTo(forward ? 0 : api.scrollSnapList().length - 1, reducedMotion.matches);
		}
		function schedule() {
			clearTimeout(timer);
			if (reducedMotion.matches || !inView || hovered || dragging || document.hidden || (gallery.contains(document.activeElement) && (document.activeElement.matches(':focus-visible') || document.activeElement.tagName === 'MODEL-VIEWER')) || (viewer && viewer.open)) return;
			timer = setTimeout(function () {
				if (viewer && viewer.open) { schedule(); return; }
				advance(true);
				schedule();
			}, 3000);
		}
		function updateVisibility() {
			var visible = api.slidesInView();
			slides.forEach(function (slide, index) {
				var shown = visible.indexOf(index) !== -1;
				slide.inert = !shown;
				slide.setAttribute('aria-hidden', String(!shown));
			});
		}
		function prepareNearby() {
			if (!window.SiteLoading) return;
			var selected = api.selectedScrollSnap();
			[selected, (selected + 1) % slides.length].forEach(function (index) {
				slides[index].querySelectorAll('img').forEach(function (image) { SiteLoading.image(image, inView ? 0 : 10); });
			});
		}
		function update() {
			previous.disabled = next.disabled = api.scrollSnapList().length < 2;
			updateVisibility();
			prepareNearby();
			schedule();
		}
		previous.addEventListener('click', function () { advance(false); });
		next.addEventListener('click', function () { advance(true); });
		gallery.addEventListener('keydown', function (event) {
			if (event.target.closest('model-viewer, video')) return;
			if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
			event.preventDefault();
			advance(event.key === 'ArrowRight');
		});
		gallery.addEventListener('mouseenter', function () { hovered = true; schedule(); });
		gallery.addEventListener('mouseleave', function () { hovered = false; schedule(); });
		gallery.addEventListener('focusin', schedule);
		gallery.addEventListener('focusout', function () { setTimeout(schedule, 0); });
		api.on('select', update).on('reInit', update).on('slidesInView', updateVisibility);
		api.on('pointerDown', function () { dragging = true; clearTimeout(timer); });
		api.on('pointerUp', function () { dragging = false; schedule(); });
		document.addEventListener('visibilitychange', schedule);
		if (viewer) {
			viewer.addEventListener('vieweropen', function () { clearTimeout(timer); });
			viewer.addEventListener('close', schedule);
		}
		reducedMotion.addEventListener('change', schedule);
		if ('IntersectionObserver' in window) new IntersectionObserver(function (entries) { inView = entries[0].isIntersecting; if (inView) prepareNearby(); schedule(); }, { threshold: 0.2 }).observe(gallery);
		else { inView = true; schedule(); }
		update();
	});
})();
