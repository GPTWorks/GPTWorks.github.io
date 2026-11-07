/* Labels for the Lens viewer controls, and in-panel jumps. */
(function () {
	function label(selector, text) {
		document.querySelectorAll(selector).forEach(function (el) {
			el.setAttribute('role', 'button');
			el.tabIndex = 0;
			el.setAttribute('aria-label', text);
		});
	}
	label('#viewer .nav-next', 'Next project');
	label('#viewer .nav-previous', 'Previous project');
	label('#viewer .toggle, #main .toggle', 'Show or hide the project list');

	document.addEventListener('keydown', function (event) {
		var target = event.target;
		if (!target || !target.matches) return;
		if ((event.key === 'Enter' || event.key === ' ') && target.matches('#viewer .nav-next, #viewer .nav-previous, #viewer .toggle, #main .toggle')) {
			event.preventDefault();
			target.click();
		}
	});

	document.querySelectorAll('#main a[href^="#"]').forEach(function (link) {
		link.addEventListener('click', function (event) {
			var id = link.getAttribute('href').slice(1);
			var el = document.getElementById(id);
			if (!el) return;
			event.preventDefault();
			el.scrollIntoView({block: 'start'});
		});
	});
})();
