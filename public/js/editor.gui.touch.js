/* editor.gui.touch.js
*/

// TouchDrop: transfroms touch events into drag and drop events
(function(scope) {

	var dropTarget;

	var TouchDrop = {
		findTarget: function(clientX, clientY) {
			var targets = $('[dropzone]:visible').get().filter(function(el) {
				var r = el.getBoundingClientRect();
				return clientY >= r.top && clientY <= r.bottom && clientX >= r.left && clientX <= r.right;
			});
			switch(targets.length) {
				case 0: return null;
				case 1: return targets[0];
				default:
					if (targets[0].nodeName == 'BODY')
						return targets[1];
					else
						return targets[0];
			}
		},
		sendEvent: function(target, eventType, clientX, clientY) {
			if (!target)
				return;
			// ev emulates dom event structure our code expects
			var ev = {
				preventDefault: function() {},
				stopPropagation: function() {},
				clientX: clientX,
				clientY: clientY,
				currentTarget: target,
				dataTransfer: {
					files: null,
					types: {
						contains: function() { return false;}
					}
				}
			};
			var jqEvent = $.Event(eventType);
			jqEvent.originalEvent = ev;
			$(target).trigger(jqEvent);
		},
		setDropTarget: function(newTarget) {
			if (dropTarget == newTarget)
				return;
			this.sendEvent(dropTarget, 'dragleave');
			dropTarget = newTarget;
			this.sendEvent(dropTarget, 'dragstart');
		},
		touchmove: function(clientX, clientY) {
			this.setDropTarget(this.findTarget(clientX, clientY));
			this.sendEvent(dropTarget, 'dragover', clientX, clientY);
		},
		touchend: function() {
			this.sendEvent(dropTarget, 'drop');
			this.setDropTarget();
		}
	};
	scope.TouchDrop = TouchDrop;
})(window.GUI);

(function(scope) {

	var TouchTrack = function(findTargetCb, startDragCb, stopDragCb) {
		if (typeof findTargetCb == 'string')
		{
			var targetType = findTargetCb;
			findTargetCb = function(element, clientX, clientY) {
				element = $(element).get(0);
				var r = element.getBoundingClientRect();
				return { dom: element, type: targetType,
					offsetX: clientX - r.left, offsetY: clientY - r.top };
			}
		}
		this._findTargetCb = findTargetCb;
		this._startDragCb = startDragCb;
		this._stopDragCb = stopDragCb;
		this._start = null; // first touch event
		this._last = { clientX: 0, clientY: 0}; // location of last touch event
		this._domCopy = null; // clone of the element we are dragging
		this._source = null; // element we are dragging
		this._delayed = false;	// delayed start of tracking, holds id of delayTimeotu
	};

	TouchTrack.prototype = {
		startTracking: function(element, touchEvent, delayed) {
			this.start = touchEvent;
			this.last = touchEvent;
			this.findSource(element, touchEvent.clientX, touchEvent.clientY);
			var THIS = this;
			function finishStart() {
				THIS.createDragImage();
				GUI.DragStore.reset(THIS._source.type, {dom: THIS._source.dom});
				THIS._delayed = false;
				if (THIS._startDragCb)
					THIS._startDragCb();
			}
			if (delayed)
				this._delayed = window.setTimeout(finishStart, 500);
			else
				finishStart();
		},
		track: function(touchEvent) {
			if (this.delayed)
				return;
			var topDiff = touchEvent.clientY - this._last.clientY;
			var leftDiff = touchEvent.clientX - this._last.clientX;
			this._domCopy.css({
				top: "+=" + topDiff,
				left: "+=" + leftDiff
			});
			this.last = touchEvent;
		},
		stopTracking: function() {
			if (this.delayed) {
				window.clearTimeout(this._delayed);
				this._delayed = false;
			}
			if (!GUI.DragStore.hadDrop) {
				// Animate snap item back if there was no drop
				var r = this._source.dom.getBoundingClientRect();
				var THIS = this;
				$(this._domCopy).animate({ top: r.top, left: r.left }, 50,
					function() {
						THIS.domCopy = null;
					});
			}
			else
				this.domCopy = null;
			this.last = null;
			if (this._stopDragCb)
				this._stopDragCb();
			GUI.DragStore.reset();
			this._source = null;
		},
		createDragImage: function(touchTrack) {
			var r = this._source.dom.getBoundingClientRect();
			this.domCopy = $(this._source.dom).clone();
			this.domCopy.addClass('touch-drag-src')
				.css({
				position: 'absolute',
				top: r.top, left: r.left, width: r.width, height: r.height
			});
			$('body').append(this._domCopy);
		},

		findSource: function(element, clientX, clientY) {
			this._source = this._findTargetCb(element, clientX, clientY);
		},

		get identifier() {
			if (!(('_start' in this) || ('identifier' in this._start)))
				debugger;
			return this._start.identifier;
		},
		get delayed() { return this._delayed; },

		get last() { return this._last; },
		set last(touchEvent) {
			if (touchEvent) {
				this._last.clientX = touchEvent.clientX;
				this._last.clientY = touchEvent.clientY;
			}
			else
				this._last = {};
		},

		get start() { return this._start; },
		set start(touchEvent) {
			this._start = touchEvent;
		},

		get domCopy() { return this._domCopy },
		set domCopy(el) {
			if (this._domCopy)
				this._domCopy.stop().remove();
			this._domCopy = el;
		}
	}
	var TouchDragHandler = {
		makeDraggable: function(el, findTargetCb, startDragCb, stopDragCb) {
			var touchTrack = new TouchTrack(findTargetCb, startDragCb, stopDragCb);
//			console.log("TouchDrag.makeDraggable");
			$(el).attr('draggable', true).on({
				touchstart: function(ev) { TouchDragHandler.touchstart(ev.originalEvent, touchTrack)},
				touchmove: function(ev) { TouchDragHandler.touchmove(ev.originalEvent, touchTrack)},
				touchend: function(ev) { TouchDragHandler.touchend(ev.originalEvent, touchTrack)},
				touchcancel: function(ev) { TouchDragHandler.touchcancel(ev.originalEvent, touchTrack)}
			});
		},
		touchItemById: function(touchList, identifier) {
			for (var i=0; i<touchList.length; i++) {
				if (touchList[i].identifier == identifier)
					return touchList[i];
			}
			return null;
		},
		touchstart: function(ev, touchTrack) {
//			console.log('touchstart', ev.currentTarget);
			if (ev.touches.length > 1)
				return;
			touchTrack.startTracking(ev.currentTarget,
				ev.touches[0],
				$._data(ev.currentTarget, 'events').click);
			ev.preventDefault();
		},
		touchmove: function(ev, touchTrack) {
			var newTouch = this.touchItemById(ev.changedTouches, touchTrack.identifier);
			if (!newTouch) {
				console.log('touchmove ignored');
				return;
			}
		//	console.log('touchmove');
			touchTrack.track(newTouch);
			if (!touchTrack.delayed)
				ev.preventDefault();
			scope.TouchDrop.touchmove(newTouch.clientX, newTouch.clientY);
		},
		touchend: function(ev, touchTrack) {
			var newTouch = this.touchItemById(ev.changedTouches, touchTrack.identifier);
			if (!newTouch) {
				console.log('touchend ignored');
				return;
			}
			scope.TouchDrop.touchend();
//			console.log('touchend');
			if (touchTrack.delayed && $._data(ev.currentTarget, 'events').click) {
				$(ev.target).click();
			}
			ev.preventDefault();
			touchTrack.stopTracking();
		},
		touchcancel: function(ev, touchTrack) {
			if (this.touchItemById(ev.changedTouches, touchTrack.identifier)) {
				touchTrack.stopTracking();
				console.log('touchcancel');
				ev.preventDefault();
			}
			else
				console.log('touchcancel ignored');
		}
	}
	scope.TouchDragHandler = TouchDragHandler;
})(window.GUI);

