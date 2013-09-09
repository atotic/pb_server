// editor.gui.util.js

// Misc utilities
(function(scope) {
"use strict";
var Util = {
	// false not in rect, 'left' to the left, 'right' to the right
	pointInClientRect: function(x, y, r) {
		var inRect = y >= r.top && y <= r.bottom && x >= r.left && x <= r.right;
		if (inRect) {
			var midpoint = r.left + (r.right - r.left) / 10;
			return x < midpoint ? 'before' : 'after';
		}
		else
			return false;
	},
	clamp: function(x, min, max) {
		return Math.min(Math.max(x, min), max);
	},
	// Workaround for iPad bug 11619581. We must reregister event handlers if node is moved in dom
	// https://bugreport.apple.com/cgi-bin/WebObjects/RadarWeb.woa/56/wo/RGiDXCcK1TeSzthooVQzbw/13.66
	// direction is before or after
	moveNode: function(src, dest, direction) {
		// Remove from DOM
		src = $(src);
		dest = $(dest);
		src.detach();
		// Save all the events
		var events = $._data(src.get(0), 'events');
		var handlers = [];
		for (var eventType in events)
			if (eventType.match(/touch/)) // Only touch events are affected
				events[eventType].forEach(function(event) {
					var record = {};
					record[eventType] = event.handler;
					handlers.push(record);
				});
		// Detach all the events
		handlers.forEach(function(h) {
			var x = src.off(h);
		});
		// Insert into DOM
		if (direction == 'before')
			dest.before(src);
		else
			dest.after(src);
		// Reattach the events
		handlers.forEach(function(h) {
			src.bind(h);
		});
	},
	revealByScrolling: function(el, container) {
		el = $(el).get(0);
		container = container || el.parentNode;
		container = $(container).stop(true, false).get(0);
		if (el.nodeName == 'IMG' && el.offsetHeight == 0) {
			// edge case: img not yet loaded, scroll when image loads
			var scrollWhenLoaded = function() {
				el.removeEventListener('load',scrollWhenLoaded);
				Util.revealByScrolling(el, container);
			}
			el.addEventListener('load', scrollWhenLoaded);
			return;
		}
		var elTop = el.offsetTop;
		var elBottom = elTop + el.offsetHeight;
		var containerTop = container.scrollTop;
		var containerBottom = containerTop + container.offsetHeight;
		if (elTop < containerTop) {
//				console.log("setting scrollTop to " ,elTop - 4);
			$(container).animate({ scrollTop: elTop - 4});
		}
		else if (elBottom > containerBottom) {
//				console.log("setting scrollTop to ", elBottom - container.offsetHeight);
			$(container).animate({scrollTop: elBottom - container.offsetHeight});
		}
		else
			;//console.log("not scrolling", elTop, elBottom, containerTop, containerBottom);
	},
	swapDom: function(a, b) {
		var parent = a.parentNode;
		var sibling= a.nextSibling === b ? a : a.nextSibling;
		this.moveNode(a, b, 'before');
		this.moveNode(b, sibling, 'before');
//			b.parentNode.insertBefore(a, b);
//			parent.insertBefore(b, sibling);
	},
	imgToCanvas: function(img) {
		var canvas = $("<canvas />")
			.attr('width', img.width)
			.attr('height', img.height)
			.get(0);
		canvas.getContext('2d')
			.drawImage(img, 0,0, img.width, img.height);
		return canvas;
	},
	// clones DOM, then copies any canvases
	cloneDomWithCanvas: function(el) {
		var $el = $(el);
		var $clone = $el.clone();
		var $srcCanvas = $el.find('canvas');
		var $destCanvas = $clone.find('canvas');
		if (($el).prop('nodeName') == 'CANVAS') {
			$srcCanvas = $srcCanvas.add($el);
			$destCanvas = $destCanvas.add($clone);
		}
		for (var i=0; i<$srcCanvas.length; i++) {
			var src = $srcCanvas.get(i);
			var dest = $destCanvas.get(i);
			var srcContext = src.getContext('2d');
			var destContext = dest.getContext('2d');
			var w = $(src).width();
			var h = $(src).height();
			destContext.drawImage(src, 0,0,w,h);
			// destContext.drawImage(src, 0, 0);
			// destContext.fillRect(0,0,100,100);
		}
		return $clone;
	},
	// returns css path, parent
	getPath: function (el, parent_id) {
		el = $(el);
		if (parent_id === undefined)
			parent_id = 'this is not an id';

		var path = "";

		while (el.length > 0) {
			var realEl = el.get(0);
			if (realEl.id === parent_id) {
				path = '#' + realEl.id + ">" + path;
				return path;
			}
			var name = el.get(0).localName;
			if (!name) break;
			name = name.toLowerCase();

			if (realEl.id)
				// As soon as an id is found, there's no need to specify more.
				return name + '#' + realEl.id + (path ? '>' + path : '');
			else if (realEl.className)
				name += '.' + realEl.className.split(/\s+/).join('.');

			var parent = el.parent();
			var siblings = parent.children(name);
			if (siblings.length > 1)
				name += ':eq(' + siblings.index(el) + ')';
			path = name + (path ? '>' + path : '');
			el = parent;
		}
		return path;
	},
	getTextHeight: function($div) {
		var $clone = $div.clone();
		$(document.body).append($clone);
		$clone.css('height', 'auto');
		var style = window.getComputedStyle( $clone.get(0) );
		var height = $clone.outerHeight();
		$clone.text("A");
		var lineheight = $clone.innerHeight();
		$clone.remove();
		return { divheight: height, lineheight: lineheight };
	},
	getPageLocation: function($ev) {
		var ev = $ev.originalEvent;
		var retVal;
		if ('changedTouches' in ev)
			retVal = { x: ev.changedTouches[0].pageX,
				y: ev.changedTouches[0].pageY};
		else
			retVal = { x: ev.pageX, y: ev.pageY };
		if (retVal.x == undefined)
			console.error("bad getPageLocation", $ev);
		return retVal;
	},
	focusOnDom: function($textDom, options) {
		options = $.extend( {
			select: 'all'	// none | all | start | end
		}, options);
		var dom = $textDom[0];
		window.setTimeout( function() {
			dom.focus();
			if (options.select != 'none')
				window.setTimeout( function() {
					switch(options.select) {
					case 'all': dom.setSelectionRange(0, 36000); return;
					case 'start': dom.setSelectionRange(0,0); return;
					case 'end': dom.setSelectionRange(36000, 36000); return;
					default: console.warn('unknown sel range', options.select);
					}
				}, 0);
		}, 0);
	}
}

scope.Util = Util;
})(window.GUI);
