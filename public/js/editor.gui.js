/*
	GUI Manipulation
	Classes:
	window.GUI: Container for event handling

	window.GUI.Buttons // button event handlers

	window.GUI.Command // command definitions
	window.GUI.CommandManager // command execution (keyboard shortcuts)
	window.GUI.Util // misc

	window.GUI.Controller // implements command actions (resizes, dom manipulation, broadcast to model)

// Each main area of the screen has its own area
	window.GUI.PhotoPalette // dragging of images inside photo palette
	window.GUI.RoughWorkArea // #rough-work-area Dnd

// Touch event handling
	window.GUI.TouchDrop // transforms touch events into drop events
	window.GUI.TouchDragHandler // touch dragging framework
	window.GUI.DragStore // stores dragged items


GUI holds references to model objects in $(dom element).data('model')
The incomplete list of elements and their models:
.rough-page -> PB.RoughPage
#photo-list > img -> PB.Photo
#work-area-rough -> PB.Book
.rough-tile -> PB.Photo
Each dom element holding a model listens for PB.MODEL_CHANGED events
*/


(function(window) {
"use strict";
		var GUI = {
		init: function() {
			this.Buttons.init();
			this.CommandManager.init();
		},
		bindToBook: function(book) {
			$('body')
				.data('model', book)
				.on( PB.MODEL_CHANGED, function(ev, model, prop, options) {
					if (prop === 'locked' && book.locked) {
						$('#locked').slideDown();
						$('#lockedMessage').text(book.locked);
					}
				});
			GUI.PhotoPalette.bindToBook(book);
			GUI.RoughWorkArea.bindToBook(book);
			window.document.title = book.title + " PhotoBook";
		}
	};
	window.GUI = GUI;

})(window);

// Graphics utilities
(function(scope) {
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
			container = $(container).get(0);
			var elTop = el.offsetTop;
			var elBottom = elTop + el.offsetHeight;
			var containerTop = container.scrollTop;
			var containerBottom = containerTop + container.offsetHeight;
			if (elTop < containerTop)
				$(container).animate({ 'scrollTop' : elTop - 4});
			else if (elBottom > containerBottom)
				$(container).animate({'scrollTop' : elBottom - container.offsetHeight});
		},
		swapDom: function(a, b, animate) {
			var parent = a.parentNode;
			var sibling= a.nextSibling === b ? a : a.nextSibling;
			this.moveNode(a, b, 'before');
			this.moveNode(b, sibling, 'before');
//			b.parentNode.insertBefore(a, b);
//			parent.insertBefore(b, sibling);
		},
		imgToDataUrl: function(img) {
			var canvas = $("<canvas />")
				.attr('width', img.width)
				.attr('height', img.height)
				.get(0);
			canvas.getContext('2d')
				.drawImage(img, 0,0, img.width, img.height);
			return canvas.toDataURL('image/jpeg');
		}
	}

	scope.Util = Util;
})(window.GUI);

// DragStore is a global used to store dragged local data
// Why? Html drag can only drag strings, we need js objects
(function(window) {
	var DragStore = {
		get hadDrop() { return this._hadDrop; },
		set hadDrop(val) { this._hadDrop = val; },

		reset: function(type, element, props) {
			this._source = null;
			this._hadDrop = false;
			if (type)
				this.setSource(type, element, props);
		},

		// Drag types:
		ROUGH_PAGE: 'roughPage',
		IMAGE: 'image',
		ADD_PAGE_BUTTON: 'addRoughPage',
		ROUGH_IMAGE: 'roughImage',

		// Common props:
		// dom: dom element being dragged
		setSource: function(type, props) {
			this._source = { type: type }
			$.extend(this._source, props);
		},
		get type() {
			return this._source ? this._source.type : null;
		},
		prop: function(propName) {
			return (this._source && (propName in this._source)) ? this._source[propName] : null;
		},
		get dom() {
			return this.prop('dom');
		},
		hasType: function() {
			if (this._source)
				for (var i=0; i<arguments.length; i++)
					if (arguments[i] == this._source.type)
						return true;
			return false;
		}
	};
	window.DragStore = DragStore;
})(window.GUI);


// CommandManager and Command
(function(scope) {
	var Command = function(name, key, meta, callback) {
		this.name = name;
		this.key = key;
		this.meta = meta;
		this.callback = callback;
	};

	var shortcuts = null;	// hash of shortcuts
	var commands = {};

	var CommandManager = {
		init: function() {
			this.add(new Command('viewMoreImages', '+', false,
				function() {scope.Controller.viewMoreImages()}));
			this.add(new Command('viewMoreImages', '=', false,
				function() {scope.Controller.viewMoreImages()}));
			this.add(new Command('viewFewerImages', '-', false,
				function() {scope.Controller.viewFewerImages()}));
			this.add(new Command('viewBiggerImages', '+', true,
				function() {scope.Controller.viewBiggerImages()}));
			this.add(new Command('viewBiggerImages', '=', true,
				function() {scope.Controller.viewBiggerImages()}));
			this.add(new Command('viewSmallerImages', '-', true,
				function() {scope.Controller.viewSmallerImages()}));
			this.add(new Command('addRoughPage', 'p', false,
				function() {scope.Controller.addRoughPage()}))
			this.add(new Command('viewAllPhotos', null, false,
				function() {scope.Controller.viewAllPhotos()}));
			this.add(new Command('viewUnusedPhotos', null, false,
				function() {scope.Controller.viewUnusedPhotos()}));
		},
		// see http://unixpapa.com/js/key.html for the madness that is js key handling
		hashString: function(rawKey, meta) {
			if (!rawKey)
				return 0;
			var key = rawKey;
			if (typeof key != 'string') {
				switch(key) {
					case 8800: key = '='; break;	// Mac option key randomness
					case 8211: key = '-'; break;
					default: key = String.fromCharCode(rawKey);
				}
			}
			var s = meta ? 'meta-' : '';
			s += key.toLowerCase();
			return s;
		},
		add: function(cmd) {
			if (shortcuts == null) {
				$('body').keypress( function(ev) {
					ev = ev.originalEvent;
					if (ev.repeat)
						return;
					var key = ev.char || ev.charCode || ev.which;
					var s = CommandManager.hashString(key, ev.altKey);	// TODO revise for windows
	//				console.log('shortcut: ', s);
					if (shortcuts[s])
						shortcuts[s].callback();
				});
				shortcuts = {};
			}
			if (cmd.key)
				shortcuts[CommandManager.hashString(cmd.key, cmd.meta)] = cmd;
			if (cmd.name)
				commands[cmd.name] = cmd;
		},
		doCommand: function(cmd ) {
			if (commands[cmd])
				commands[cmd].callback();
			else
				console.error('unknown command ' + cmd);
		}
	}
	scope.Command = Command;
	scope.CommandManager = CommandManager;
})(window.GUI);




