/* Native SVG visualizations. Public API responses are cached for 24 hours;
   the checked-in snapshot remains usable if either service is unavailable. */
(function () {
	'use strict';
	var root = document.getElementById('smart-home-insights');
	if (!root) return;
	var ns = 'http://www.w3.org/2000/svg';
	var cacheKey = 'smart-home-insights-v1';
	var day = 86400000;
	function svg(tag, attrs, text) {
		var element = document.createElementNS(ns, tag);
		Object.keys(attrs || {}).forEach(function (key) { element.setAttribute(key, attrs[key]); });
		if (text != null) element.textContent = text;
		return element;
	}
	function get(url) {
		if (window.SiteLoading) return SiteLoading.enqueue('json:' + url, 50, function () { return request(url); });
		return request(url);
	}
	async function request(url) {
		var controller = new AbortController();
		var timeout = setTimeout(function () { controller.abort(); }, 8000);
		try {
			var response = await fetch(url, { signal: controller.signal });
			if (!response.ok) throw new Error('HTTP ' + response.status);
			return await response.json();
		} finally { clearTimeout(timeout); }
	}
	function dateLabel(value) {
		return new Date(value + 'T00:00:00Z').toLocaleDateString('en', { month: 'short', year: 'numeric', timeZone: 'UTC' });
	}
	function renderHistory(data) {
		var chart = root.querySelector('.star-chart');
		chart.replaceChildren();
		var start = new Date(data.repos[0].history[0].date + 'T00:00:00Z');
		var end = new Date(data.updated + 'T00:00:00Z');
		var dates = [];
		for (var d = new Date(start); d <= end; d.setUTCMonth(d.getUTCMonth() + 1)) dates.push(d.toISOString().slice(0, 10));
		var series = data.repos.map(function (repo) {
			var value = 0;
			return dates.map(function (date) {
				repo.history.forEach(function (row) { if (row.date <= date) value = Number(row.stargazers); });
				return value;
			});
		});
		var max = Math.ceil(Math.max.apply(null, series[0].concat(series[1])) / 50) * 50;
		var x = function (i) { return 40 + i / Math.max(1, dates.length - 1) * 560; };
		var y = function (n) { return 244 - n / max * 210; };
		for (var n = 0; n <= max; n += 50) {
			chart.appendChild(svg('path', { d: 'M40 ' + y(n) + 'H600', class: 'chart-grid' }));
			chart.appendChild(svg('text', { x: 30, y: y(n) + 4, 'text-anchor': 'end', class: 'chart-label' }, n));
		}
		dates.forEach(function (date, i) {
			if (i !== 0 && date.slice(5, 7) !== '01') return;
			chart.appendChild(svg('text', { x: x(i), y: 271, class: 'chart-label', 'text-anchor': 'middle' }, date.slice(0, 4)));
		});
		series.forEach(function (values, i) {
			var path = values.map(function (value, index) { return (index ? 'L' : 'M') + x(index) + ' ' + y(value); }).join(' ');
			chart.appendChild(svg('path', { d: path, class: 'star-line star-series-' + i }));
		});
		var guide = svg('path', { class: 'chart-guide' });
		chart.appendChild(guide);
		var dots = series.map(function (_, i) {
			var dot = svg('circle', { r: 4.5, class: 'star-dot star-series-' + i });
			chart.appendChild(dot);
			return dot;
		});
		var index = dates.length - 1;
		function select(next) {
			index = Math.max(0, Math.min(dates.length - 1, next));
			guide.setAttribute('d', 'M' + x(index) + ' 24V244');
			dots.forEach(function (dot, i) { dot.setAttribute('cx', x(index)); dot.setAttribute('cy', y(series[i][index])); });
			root.querySelector('.history-date').textContent = dateLabel(dates[index]);
			root.querySelectorAll('[data-history-value]').forEach(function (el, i) { el.textContent = series[i][index]; });
			chart.setAttribute('aria-label', 'Recorded star events, ' + dateLabel(dates[index]) + ': XGIMI4HA ' + series[0][index] + ', HisenseHA ' + series[1][index] + '. Use left and right arrow keys to explore.');
		}
		chart.onpointermove = function (event) {
			var point = chart.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
			point = point.matrixTransform(chart.getScreenCTM().inverse());
			select(Math.round((point.x - 40) / 560 * (dates.length - 1)));
		};
		chart.onpointerleave = function () { select(dates.length - 1); };
		chart.onkeydown = function (event) {
			if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
			event.preventDefault(); select(index + (event.key === 'ArrowRight' ? 1 : -1));
		};
		select(index);
	}
	function renderMap(data, world) {
		var map = root.querySelector('.community-map');
		map.replaceChildren();
		world.forEach(function (country) {
			map.appendChild(svg('path', { d: country.path, class: 'map-land', 'fill-rule': 'evenodd' }));
		});
		var detail = root.querySelector('.map-detail');
		var defaultDetail = 'Asia · Europe · The Americas · Oceania';
		data.countries.slice().reverse().forEach(function (row) {
			var country = world.find(function (c) { return c.code === row.country_code; });
			if (!country) return;
			var label = country.name + ': ' + row.stargazers + ' recorded stargazers';
			var bubble = svg('g', { tabindex: '0', role: 'img', 'aria-label': label, class: 'map-marker' });
			var radius = 4 + Math.sqrt(Number(row.stargazers)) * 3;
			bubble.appendChild(svg('circle', { cx: country.x, cy: country.y, r: radius + 5, class: 'map-halo' }));
			bubble.appendChild(svg('circle', { cx: country.x, cy: country.y, r: radius, class: 'map-bubble' }));
			bubble.appendChild(svg('title', {}, label));
			bubble.onmouseenter = bubble.onfocus = function () { detail.textContent = label; };
			bubble.onmouseleave = bubble.onblur = function () { detail.textContent = defaultDetail; };
			bubble.onclick = function () { detail.textContent = label; };
			map.appendChild(bubble);
		});
		detail.textContent = defaultDetail;
		root.querySelector('[data-country-count]').textContent = data.countries.length;
	}
	function render(data, world) {
		root.querySelector('[data-star-total]').textContent = data.repos.reduce(function (sum, repo) { return sum + repo.stars; }, 0);
		renderHistory(data); renderMap(data, world);
		root.classList.add('insights-ready');
	}
	async function init() {
		try {
			// The first view never depends on network requests.
			// Read geometry from the already-visible, pre-rendered SVG snapshot.
			var snapshot = JSON.parse(document.getElementById('smart-home-snapshot').textContent);
			var world = Array.from(root.querySelectorAll('.map-land')).map(function (path) {
				return { code: path.dataset.code, name: path.dataset.name, x: Number(path.dataset.x), y: Number(path.dataset.y), path: path.getAttribute('d') };
			});
			var data = snapshot, cached;
			try { cached = JSON.parse(localStorage.getItem(cacheKey)); } catch (_) {}
			var fresh = cached && cached.version === 1 && Date.now() - cached.saved < day;
			if (fresh) {
				try { render(cached.data, world); return; } catch (_) { data = snapshot; }
			}
			render(snapshot, world);
			await new Promise(function (resolve) {
				if (!('IntersectionObserver' in window)) { resolve(); return; }
				var observer = new IntersectionObserver(function (entries) {
					if (entries.some(function (entry) { return entry.isIntersecting; })) { observer.disconnect(); resolve(); }
				}, { rootMargin: '300px' });
				observer.observe(root);
			});
			var api = 'https://api.ossinsight.io/v1/repos/manymuch/';
			var today = new Date().toISOString().slice(0, 10);
			var stars = data.repos.map(function (repo) { return get('https://api.github.com/repos/manymuch/' + repo.repo); });
			var events = data.repos.map(function (repo) { return get(api + repo.repo + '/stargazers/history/?per=month&from=2022-01-01&to=' + today); });
			var results = await Promise.allSettled(stars.concat(events, [get(api + 'Xgimi-4-Home-Assistant/stargazers/countries')]));
			var starsOK = results.slice(0, 2).every(function (r) { return r.status === 'fulfilled' && Number.isFinite(r.value.stargazers_count); });
			if (starsOK) {
				data.repos.forEach(function (repo, i) { repo.stars = results[i].value.stargazers_count; });
				data.starsUpdated = today;
			}
			var eventsOK = results.slice(2).every(function (r) { return r.status === 'fulfilled' && r.value.data && Array.isArray(r.value.data.rows) && r.value.data.rows.length; });
			if (eventsOK) {
				data.repos.forEach(function (repo, i) { repo.history = results[i + 2].value.data.rows; });
				data.countries = results[4].value.data.rows.filter(function (row) { return row.country_code && Number(row.stargazers) > 0; });
				data.eventsUpdated = today; data.updated = today;
			}
			render(data, world);
			if (starsOK && eventsOK) try { localStorage.setItem(cacheKey, JSON.stringify({ version: 1, saved: Date.now(), data: data })); } catch (_) {}
		} catch (_) {
			// Keep the baked-in snapshot visible if live enhancement is unavailable.
		}
	}
	init();
})();
