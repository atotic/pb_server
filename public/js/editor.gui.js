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
		function stopEvent(ev) {
			ev.stopPropagation();
			ev.preventDefault();
		}

		var GUI = {
		init: function() {
			this.Buttons.init();
			this.CommandManager.init();
			this.Tools.init();
			this.initShortcuts();
			window.setTimeout(GUI.fixSizes,0);
			$(window).resize(GUI.fixSizes);
		},
		fixSizes: function() {
			$('#sidebar').css('top', $('#top-menu').height());
			$('#main-content').css('top', $('#top-menu').height());
			$('#main-content').width($('body').width() - $('#sidebar').width());
			var h = $('body').height() - $('#top-menu').height() - $('#palette').outerHeight();
			$('#work-area').css('height', h);
			$('#work-area-container').css('height', h-parseInt($('#work-area').css('padding-top')));
		},
		initShortcuts: function() {
			this.CommandManager.add(new this.Command('viewMoreImages', '+', false,
				function() {GUI.Controller.viewMoreImages()}));
			this.CommandManager.add(new this.Command('viewMoreImages', '=', false,
				function() {GUI.Controller.viewMoreImages()}));
			this.CommandManager.add(new this.Command('viewFewerImages', '-', false,
				function() {GUI.Controller.viewFewerImages()}));
			this.CommandManager.add(new this.Command('viewBiggerImages', '+', true,
				function() {GUI.Controller.viewBiggerImages()}));
			this.CommandManager.add(new this.Command('viewBiggerImages', '=', true,
				function() {GUI.Controller.viewBiggerImages()}));
			this.CommandManager.add(new GUI.Command('viewSmallerImages', '-', true,
				function() {GUI.Controller.viewSmallerImages()}));
			this.CommandManager.add(new GUI.Command('addRoughPage', 'p', false,
				function() {GUI.Controller.addRoughPage()}))
			this.CommandManager.add(new GUI.Command('viewAllPhotos', null, false,
				function() {GUI.Controller.viewAllPhotos()}));
			GUI.CommandManager.add(new GUI.Command('viewUnusedPhotos', null, false,
				function() {GUI.Controller.viewUnusedPhotos()}));
			GUI.CommandManager.add(new GUI.Command("HideTools", GUI.CommandManager.keys.esc, false,
				GUI.toggleTools));
		},
		bindToBook: function(book) {
			$('body')
				.data('model', book)
				.attr('dropzone', true)
				.on(PB.MODEL_CHANGED, function(ev, model, prop, options) {
					if (prop === 'locked' && book.locked) {
						$('#error-locked').slideDown();
						$('#lockedMessage').text(book.locked);
					}
				});
			var bodyDropHandler = {
				dragenter: function(ev) {
//					console.log('dragenter');
//					ev = ev.originalEvent;
//					var isFile = ev.dataTransfer.types.contains("Files");
				},
				dragover: function(ev) {
					// stopping event here prevents default action, which is loading new url
//					console.log('dragover');
					stopEvent(ev);
				},
				dragleave: function(ev) {
//					$('#photo-list').removeClass('drop-target');
//					console.log('dragleave');
					stopEvent(ev);
				},
				drop: function(ev) {
					ev = ev.originalEvent;
//					$('#photo-list').removeClass('drop-target');
					var files = ev.dataTransfer.files;
					if (files)
						for (var i=0; i<files.length; i++) {
							var f = files.item(i);
							if (f.type.match("image/(png|jpeg|gif)"))
								PB.Book.default.addLocalPhoto(f, {animate: true});
						}
//					console.log('drop');
					stopEvent(ev);
				}
			}
			$('body').on(bodyDropHandler);
			GUI.PhotoPalette.bindToBook(book);
			GUI.RoughWorkArea.bindToBook(book);
			window.document.title = book.title + " PhotoBook";
		},
		toggleTools: function() {
			$('#rough-more-tools').stop(true).slideToggle(50, function() {
				if ($('#rough-more-tools:visible').length > 0)
					GUI.Tools.loadFromOptions();
			});
		}
	};
	window.GUI = GUI;

})(window);

// GUI Options
(function(scope) {
"use strict";
	var Options = {
		_photoFilter: 'unused', // 'all' | 'unused'
		_photoSort: 'added', // 'added' | 'taken' | 'name'
		_photoSize: 'medium', // 'small' | 'medium' | 'large'
		_pageSize: 'medium', // 'small' | 'medium' | 'large'
		get photoFilter() { return this._photoFilter; },
		get photoSort() { return this._photoSort; },
		get photoSize() { return this._photoSize; },
		get photoSizeHeight() {
			switch(this._photoSize) {
				case 'small':
					return 96;
				case 'medium':
					return 128;
				case 'large':
					return 196;
			}
		},
		get photoSizeWidth() {
			return this.photoSizeHeight * 1.34;	// 4/3 ratio
		},
		get pageSize() { return this._pageSize; },

		get pageSizePixels() {
			switch(this._pageSize) {
				case 'small':
					return 96;
				case 'medium':
					return 128;
				case 'large':
					return 196;
			}
		},
		set photoFilter(val) {
			if (val == this._photoFilter)
				return;
			this._photoFilter = val;
			this.broadcast('photoFilter', val);
		},
		set photoSort(val) {
			if (val == this._photoSort)
				return;
			this._photoSort = val;
			this.broadcast('photoSort', val);
		},
		set photoSize(val) {
			if (val == this._photoSize)
				return;
			this._photoSize = val;
			this.broadcast('photoSize', val);
		},
		set pageSize(val) {
			if (val == this._pageSize)
				return;
			this._pageSize = val;
			this.broadcast('pageSize', val);
		},

		_listeners: [],
		// listener: function(propertyName, newValue)
		addListener: function(listener) {
			var idx = this._listeners.indexOf(listener);
			if (idx == -1)
				this._listeners.push(listener);
		},
		removeListener: function(listener) {
			var idx = this._listeners.indexOf(listener);
			if (idx != -1)
				this._listeners.splice(idx, 1);
			else
				console.warn('GUI.Options removing non-existent listener',listener);
		},
		broadcast: function(propName, propVal) {
			try {
				for (var i=0; i<this._listeners.length; i++)
					this._listeners[i](propName, propVal);
			}
			catch(ex) {
				console.error("Unexpected error broadcasting options", ex);
			}
		}
	};
	scope.Options = Options;
})(GUI);

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
		swapDom: function(a, b, animate) {
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
		}
	}

	scope.Util = Util;
})(window.GUI);

// DragStore is a global used to store dragged local data
// Why? Html drag can only drag strings, we need js objects
// Limitation: holds only one flavor
(function(window) {
	var DragStore = {
		get hadDrop() { return this._hadDrop; },
		set hadDrop(val) { this._hadDrop = val; },

		reset: function(type, element, props) {
			this._source = null;
			this._hadDrop = false;
			if (type)
				this.setFlavor(type, element, props);
		},

		// Drag flavors:
		ROUGH_PAGE: 'roughPage',
		IMAGE: 'image',
		ADD_PAGE_BUTTON: 'addRoughPage',
		ROUGH_IMAGE: 'roughImage',
		OS_FILE: 'os_file',

		// Common props:
		// dom: dom element being dragged
		setFlavor: function(flavor, props) {
//			console.log("DragStore.setFlavor", flavor);
			this._source = { flavor: flavor }
			$.extend(this._source, props);
		},
		setDataTransferFlavor: function(dataTransfer) {
			var isFile;
			(!dataTransfer.types)
				return;
			if ('contains' in dataTransfer.types)	// Firefox
				isFile = dataTransfer.types.contains("Files");
			else // Chrome
				isFile = dataTransfer.types.indexOf("Files") != -1;
			if (isFile)
				this.setFlavor(DragStore.OS_FILE, true);
		},
		get flavor() {
			return this._source ? this._source.flavor : null;
		},
		prop: function(propName) {
			return (this._source && (propName in this._source)) ? this._source[propName] : null;
		},
		get dom() {
			return this.prop('dom');
		},
		hasFlavor: function() {
			if (this._source)
				for (var i=0; i<arguments.length; i++)
					if (arguments[i] == this._source.flavor)
						return true;
			return false;
		}
	};
	window.DragStore = DragStore;
})(window.GUI);

(function(scope) {
	var Error = {
		photoTooBig: function(photo) {
			var bigAlert = $('#big-alert');
			if (bigAlert.length == 0) {
				var text = "<p>These photos are too big. Our current upload limit is 10MB.</p>";
				text += "<p>Try making your photos smaller by resizing them in the photo editor.</p>";
				text += "<p>The photos have been removed from the book.</p>";
				bigAlert = $(PB.error(text, 'alert-error'));
				bigAlert.prop('id', 'big-alert');
			}
			PB.Book.default.removePhoto(photo, {animate:true});
			var photoMsg = $("<p><img src='" + photo.iconUrl + "' style='height:128px'>" + photo.displayName() +  "</p>");
			photoMsg.children('img')
				.data('model', photo)
				.on(PB.MODEL_CHANGED, function(ev, model, prop, options) {
					if (prop == 'icon_url')
						this.src = photo.iconUrl;
				});
			bigAlert.append(photoMsg);
		}
	};

	scope.Error = Error;

})(window.GUI);
// CommandManager and Command
(function(scope) {
	var Command = function(name, key, meta, callback) {
		this.name = name;
		this.key = key;
		this.meta = meta;
		this.callback = callback;
	};

	var shortcuts = {};	// hash of shortcuts
	var commands = {};

	var CommandManager = {
		init: function() {
			$(document).keydown( function(ev) {
				ev = ev.originalEvent;
				if (ev.repeat)
					return;
				var s = CommandManager.eventToString(ev);
				if (shortcuts[s])
					shortcuts[s].callback();
			});
		},
		keys: {	// all the keys we recognize are listed here
			esc: "esc",
			plus: "+",
			minus: "-",
			meta: "meta-"
		},
		// see http://unixpapa.com/js/key.html for the madness that is js key handling
		// 2012: most browsers not supporting html5 keyboard event specs
		eventToString: function(ev) {
			if (ev.repeat)
				return null;
			var key = null;	// key as string
			if ('keyIdentifier' in ev) {
				switch(ev.keyIdentifier) {
					case "U+001B":
						key = this.keys.esc; break;
					default:
						var keyCode = parseInt(ev.keyIdentifier.replace(/U\+/, ""), 16);
						if (keyCode)
							key = String.fromCharCode(keyCode);
						break;
				}
			}
			else if ('keyCode' in ev) {
				switch (ev.keyCode) {
					case 27:
						key = this.keys.esc; break;
					case 109:
						key = this.keys.minus; break;
					case 107:
						key = this.keys.plus; break;
					default:
						;
				}
			}
			else {
				console.warn("keyboard event without keyIdentifer or keyCode");
			}
			if (!key || key == "" || (key.length > 0 && key.charCodeAt(0) < 32))
				return null;
			var s = ev.altKey ? this.keys.meta : '';
			s += key.toLowerCase();
//			console.log("meta", ev.metaKey, "ctrl", ev.ctrlKey, "altKey", ev.altKey);
//			console.log("shortcut", s);
			return s;
		},
		asciiToString: function(key, meta) {
			var s = meta ? this.keys.meta : '';
			s += key.toLowerCase();
			return s;
		},
		add: function(cmd) {
			if (cmd.key)
				shortcuts[CommandManager.asciiToString(cmd.key, cmd.meta)] = cmd;
			if (cmd.name)
				commands[cmd.name] = cmd;
		},
		remove: function(cmd) {
			if (cmd.key) {
				var k = CommandManager.asciiToString(cmd.key, cmd.meta);
				if (k in shortcuts)
					delete shortcuts[k];
			}
			if (cmd.name && cmd.name in commands)
				delete commands[cmd.name];
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




