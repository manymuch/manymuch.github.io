/* Native anchors and section tracking; navigation also works without JS. */
(function () {
  'use strict';
  var links = Array.from(document.querySelectorAll('#nav a[href^="#"]'));
  var sections = links.map(function (link) { return document.querySelector(link.hash); });
  var pending = false;
  function update() {
    pending = false;
    var current = sections[0];
    sections.forEach(function (section) {
      if (section && section.getBoundingClientRect().top <= 160) current = section;
    });
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 3) current = sections[sections.length - 1];
    links.forEach(function (link) {
      var active = current && link.hash === '#' + current.id;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  window.addEventListener('scroll', function () {
    if (!pending) { pending = true; requestAnimationFrame(update); }
  }, { passive: true });
  window.addEventListener('hashchange', update);
  window.addEventListener('resize', update);
  update();
})();
