/* Native anchors, legacy URL normalization, and section tracking. */
(function () {
  'use strict';
  var aliases = { one: 'employment', two: 'education', three: 'publications', building: 'personal-projects' };
  function normalize() {
    var target = aliases[location.hash.slice(1)];
    if (!target) return;
    history.replaceState(history.state, '', location.pathname + location.search + '#' + target);
    var section = document.getElementById(target);
    if (section) section.scrollIntoView();
  }
  normalize();
  var links = Array.from(document.querySelectorAll('#nav a[href^="#"]'));
  var sections = links.map(function (link) { return document.getElementById(link.hash.slice(1)); });
  var pending = false;
  function update() {
    pending = false;
    var current = sections[0];
    sections.forEach(function (section) { if (section && section.getBoundingClientRect().top <= 160) current = section; });
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 3) current = sections[sections.length - 1];
    links.forEach(function (link) {
      var active = current && link.hash === '#' + current.id;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
    });
  }
  window.addEventListener('scroll', function () { if (!pending) { pending = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener('hashchange', function () { normalize(); update(); });
  window.addEventListener('pageshow', update);
  window.addEventListener('resize', update);
  update();
})();
