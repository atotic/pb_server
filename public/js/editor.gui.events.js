// editor.gui.events.js
// Higher order events
// Merge touch and mouse,

(function(scope) {
	var Events = {};

	// mousedown|touchdown, immediate trigger
	var Down = {
		bind: function(el, options) {
			if (!el)
				return;
			options = $.extend({ action: $.noop} , options);
			if (PB.hasTouch())
				el.on( { touchdown: options.action});
			else
				el.on( { mousedown: options.action});
		}
	}

	Events.Down = Down;

	scope.Events = Events;
})(GUI);
