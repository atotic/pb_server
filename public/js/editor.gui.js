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


GUI holds references to model objects in $(dom element).data('modelp')
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
			src.detach();
			// Save all the events
			var events = $._data(src.get(0), 'events');
			var handlers = [];
			for (var eventType in events)
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
			var aparent= a.parentNode;
			var asibling= a.nextSibling===b? a : a.nextSibling;
			b.parentNode.insertBefore(a, b);
			aparent.insertBefore(b, asibling);
		}

	}

	scope.Util = Util;
})(window.GUI);

// DragStore is a global used to store dragged local data
// Why? Html drag can only drag strings, we need js objects
// Drag types are not available dragover callback
(function(window) {
	var DragStore = {
		start: function() {
//			console.log("DragStore.start");
			this._roughPage = null;	// .rough-page dom object, model is PB.RoughPage
			this._image = null; // img dom object, model is PB.Photo
			this._roughImage = null; // image inside roughPage
			this._addRoughPage = null; // true if we are dragging addButton
			this._hadDrop = false;
			return this;
		},
		clear: function() {
			this.start();
		},
		get roughPage() {return this._roughPage},
		set roughPage(val) { this._roughPage = val;},
		get image() { return this._image},
		set image(val) { this._image = val;},
		get addRoughPage() { return this._addRoughPage},
		set addRoughPage(val) { this._addRoughPage = val },
		get roughImage() { return this._roughImage },
		set roughImage(val) { this._roughImage = val;},
		get hadDrop() { return this._hadDrop; },
		set hadDrop(val) { this._hadDrop = val; }
	};
	window.DragStore = DragStore;
})(window.GUI);


// PhotoPalette
// images can be dragged out
(function(scope){
	var PhotoPalette = {
		bindToBook: function(book) {
			this._photoFilter = 'unused';
			$('#photo-list')
				.data('modelp', book.getProxy())
				.on(PB.MODEL_CHANGED,
					function(ev, model, prop, options) {
						if (prop == 'photoList')
							PhotoPalette.synchronizePhotoList();
					});
			this.synchronizePhotoList();
		},
		// valid vals: all|unused
		set photoFilter(val) {
			if (this._photoFilter != val) {
				this._photoFilter = val;
				this.synchronizePhotoList();
			}
		},
		get photoFilter() {
			return this._photoFilter;
		},
		addPhoto: function(photo) {
			var img = this.createImageTile(photo);
			$('#photo-list').append(img);
		},
		createImageTile: function(photo) {
			var img = $("<img src='" + photo.getUrl(128) + "'>");
			img.data('modelp', photo.getProxy());
			this.makeDraggable(img);
			return img;
		},
		synchronizePhotoList: function(options) {
			options = $.extend({animate:false}, options);
			var containerDom = $('#photo-list');
			var bookModel = containerDom.data('modelp').get();
			var sel = 'img';

			var oldChildren = containerDom.children( sel );
			var oldPhotos = oldChildren.map(
				function(i, el) { return $(el).data('modelp').id}).get();
			var newPhotos = this._photoFilter == 'all' ? bookModel.photoList : bookModel.unusedPhotoList;

			var diff = JsonDiff.diff(oldPhotos, newPhotos);

			for (var i=0; i<diff.length; i++) {
				var targetPath = JsonPath.query(oldPhotos, diff[i].path, {just_one: true, ghost_props: true});
				var targetIndex = targetPath.prop();
				var targetId = targetPath.val();

				switch(diff[i].op) {
				case 'set':
					var replaceDom = $(oldChildren.get(targetIndex));
					var newPhoto = bookModel.photo(diff[i].args);
					replaceDom.replaceWith(this.createImageTile(newPhoto));
				break;
				case 'insert':
					var newModel = bookModel.photo(diff[i].args);
					var newDom = this.createImageTile(newModel);
					var c = containerDom.children( sel );
					if (c.length <= targetIndex) {
						if (c.length == 0)
							containerDom.prepend(newDom);
						else
							c.last().after(newDom);
					}
					else
						$(c.get(targetIndex)).before(newDom);
				break;
				case 'delete':
					$(containerDom.children(sel).get(targetIndex)).detach();
				break;
				case 'swap':
					var src = containerDom.children(sel).get(targetIndex);
					var destIndex = JsonPath.lastProp(diff[i].args);
					var dest = contanerDom.children(sel).get(destIndex);
					GUI.Util.swapDom(src, dest, options.animate);
				break;
				}
			}
		}
	}

	var PhotoPaletteDnd = {
		makeDraggable: function(img) {
			$(img).attr('draggable', true).on( {
				'dragstart': function(ev) {
					ev = ev.originalEvent;
					ev.dataTransfer.setData('text/uri-list', this.src);
		//			console.log("DragStore.start photo-list img");
					scope.DragStore.start().image = this;
					ev.effectAllowed = 'move';
				},
				'dragend': function(ev) {
		//			console.log("DragStore.clear photo-list img");
					scope.DragStore.clear();
				}
			});
		}
	}
	var PhotoPaletteTouch = {
		makeDraggable: function(img) {
			scope.TouchDragHandler.makeDraggable(img, 'image');
		}
	}

	if (PB.hasTouch()) {
		$.extend(PhotoPalette, PhotoPaletteTouch);
	}
	else
		$.extend(PhotoPalette, PhotoPaletteDnd);

	scope.PhotoPalette = PhotoPalette;
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




