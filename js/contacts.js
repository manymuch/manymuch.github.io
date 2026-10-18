(function () {
	'use strict';
	var contact = document.querySelector('.profile-contact');
	if (!contact) return;
	var hint = contact.querySelector('.contact-copy-hint');
	var timer;
	function fallbackCopy(value) {
		var active = document.activeElement;
		var selection = window.getSelection();
		var ranges = [];
		for (var i = 0; selection && i < selection.rangeCount; i++) ranges.push(selection.getRangeAt(i));
		var input = document.createElement('textarea');
		input.value = value;
		input.readOnly = true;
		input.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
		document.body.appendChild(input);
		var copied = false;
		try { input.select(); copied = document.execCommand('copy'); }
		finally {
			input.remove();
			if (active) active.focus({ preventScroll: true });
			if (selection) { selection.removeAllRanges(); ranges.forEach(function (range) { selection.addRange(range); }); }
		}
		if (!copied) throw new Error('Copy unavailable');
	}
	contact.querySelectorAll('.contact-copy').forEach(function (button) {
		function showPrompt() {
			if (!contact.classList.contains('has-copy-feedback')) hint.textContent = 'Click to copy';
		}
		button.addEventListener('mouseenter', showPrompt);
		button.addEventListener('focus', showPrompt);
		button.addEventListener('click', async function () {
			clearTimeout(timer);
			try {
				try {
					if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('Use fallback');
					await navigator.clipboard.writeText(button.dataset.copy);
				} catch (_) { fallbackCopy(button.dataset.copy); }
				hint.textContent = button.dataset.copyLabel + ' copied!';
			} catch (_) { hint.textContent = 'Copy unavailable — please select the text'; }
			contact.classList.add('has-copy-feedback');
			timer = setTimeout(function () {
				contact.classList.remove('has-copy-feedback');
				hint.textContent = 'Click to copy';
			}, 2500);
		});
	});
})();

(function () {
	'use strict';
	var popover = document.querySelector('.wechat-popover');
	if (!popover) return;
	var trigger = popover.querySelector('button');
	trigger.addEventListener('click', function () {
		var open = popover.classList.toggle('is-open');
		trigger.setAttribute('aria-expanded', String(open));
	});
	document.addEventListener('click', function (event) {
		if (!popover.contains(event.target)) closePopover();
	});
	document.addEventListener('keydown', function (event) {
		if (event.key === 'Escape') {
			closePopover();
			if (popover.contains(document.activeElement)) trigger.blur();
		}
	});
	function closePopover() {
		popover.classList.remove('is-open');
		trigger.setAttribute('aria-expanded', 'false');
	}
})();

