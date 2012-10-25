// editor.gui.events.js
// Higher order events
// Merge touch and mouse,

(function(scope) {
	"use strict";

	var Events = {
		// selection overlays forward their events the underlying element
		forward: function(src, dest, events) {
			events.forEach(function(event) {
				var handler = {};
				handler[event] = function(ev) { dest.trigger(ev);};
				src.on(handler);
			});
		}
	};

	// Represents single touch
	var PBMouseEvent = function(ev) {
		this.type = 'pbmouseevent';
//		this.originalEvent = ev.originalEvent;
		this.stopPropagation = function() { ev.stopPropagation()};
		this.preventDefault = function() { ev.preventDefault()};
		if (ev.type.match(/mousedown/)) {
			this.clientX = ev.clientX;
			this.clientY = ev.clientY;
		}
		else if (ev.type.match(/touchstart/)) {
			var touches = ev.originalEvent.touches;
			if (touches.length != 1)
				console.log("more than 1 touch, event aborted");
			this.clientX = touches.item(0).clientX;
			this.clientY = touches.item(0).clientY;
		}
	};

	// mousedown|touchdown, immediate trigger
	Events.Down = {
		bind: function(el, options) {
			if (!el)
				return;
			el = $(el);
			options = $.extend({ action: $.noop} , options);
			if (PB.hasTouch())
				el.on( { touchstart: function(ev) { options.action (new PBMouseEvent(ev)) }});
			else
				el.on( { mousedown: function(ev) { options.action (new PBMouseEvent(ev)) }});
		}
	}

	// Fires repeatedly until mouse leaves the button
	// options.action: function(el, callCount)
	// options.delay: msDelay | function(callCount) -> msDelay
	Events.RepeatFireButton = {
		bind: function(el, options) {
			if (!el)
				return;
			el = $(el);

		options = $.extend( { action: $.noop, delay: 100}, options);
		if ((typeof options.delay == 'number')) {
			var trueDelay = options.delay;
			options.delay = function() { return trueDelay};
		}

		var firing = false;
		var fireCount = 0;

		function fireAction() {
			if (firing) {
				options.action(el, fireCount++);
				window.setTimeout(fireAction, options.delay(fireCount));
			}
		};
		function startFiring() {
			firing = true;
			fireCount = 0;
			window.setTimeout(fireAction, 0);
		}
		function endFiring() {
			firing = false;
		}
		var handlers;
		if (PB.hasTouch()) {
			handlers = {
				touchstart: function() { startFiring() },
				touchcancel: function() { endFiring() },
				touchend: function() { endFiring() }
			}
		}
		else {
			handlers = {
				mousedown: function() { startFiring() },
				mouseup: function() { endFiring() },
				mouseleave: function() {endFiring() }
			}
		};
		el.on(handlers);
	}
}

scope.Events = Events;
})(GUI);
