// editor.gui.events.js
// Higher order events
// Merge touch and mouse,

(function(scope) {
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
	var Down = {
		bind: function(el, options) {
			if (!el)
				return;
			options = $.extend({ action: $.noop} , options);
			if (PB.hasTouch())
				el.on( { touchstart: function(ev) { options.action (new PBMouseEvent(ev)) }});
			else
				el.on( { mousedown: function(ev) { options.action (new PBMouseEvent(ev)) }});
		}
	}

	Events.Down = Down;

	scope.Events = Events;
})(GUI);
