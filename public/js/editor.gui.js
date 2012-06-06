"use strict";


(function(window) {
	window.GUI = {};
	window.PB = {
		// True if we are on touch device
		detectTouch: function() {
			return 'ontouchstart' in window;
		}
	}

})(window);

// PhotoPalette
// images can be dragged out
(function(window){
	var PhotoPalette = {
	}
	var PhotoPaletteDnd = {
		makeDraggable: function(img) {
			$(img).prop('draggable', true).on( {
				'dragstart': function(ev) {
					ev = ev.originalEvent;
					ev.dataTransfer.setData('text/uri-list', this.src);
		//			console.log("DragStore.start photo-list img");
					DragStore.start().image = this;
					ev.effectAllowed = 'move';
				},
				'dragend': function(ev) {
		//			console.log("DragStore.clear photo-list img");
					DragStore.clear();
				}
			});
		}
	}
	var PhotoPaletteTouch = {
		makeDraggable: function(img) {
			$(img).on({
				'touchstart': function(ev) { PhotoPaletteTouch.touchstart(ev.originalEvent)},
				'touchmove': function(ev) { PhotoPaletteTouch.touchmove(ev.originalEvent)},
				'touchend': function(ev) { PhotoPaletteTouch.touchend(ev.originalEvent)},
				'touchcancel': function(ev) { PhotoPaletteTouch.touchcancel(ev.originalEvent)}
			});
		},
		startTouch: null,
		lastTouch: {pageX: 0, pageY: 0},
		dragImage: null,
		touchstart: function(ev) {
			console.log('touchstart');
			if (ev.touches.length > 1)
				return;
			this.startTouch = ev.touches[0];
			this.setLastTouch(PhotoPaletteTouch.startTouch);
			this.createDragImage();
			DragStore.start().image = this.startTouch.target;
			ev.preventDefault();
		},
		createDragImage: function() {
			var r = PhotoPaletteTouch.startTouch.target.getBoundingClientRect();
			PhotoPaletteTouch.dragImage = $(PhotoPaletteTouch.startTouch.target)
				.clone()
				.addClass('touch-drag-src')
				.css({
				position: 'absolute',
				top: r.top,
				left: r.left,
				width: r.width,
				height: r.height
			});
			$('body').append(PhotoPaletteTouch.dragImage);
		},
		cancelTouch: function() {
			PhotoPaletteTouch.setLastTouch();
			PhotoPaletteTouch.dragImage.detach();
			PhotoPaletteTouch.dragImage = null;
		},
		setLastTouch: function(touch) {
			if (touch == null)
				PhotoPaletteTouch.lastTouch = {};
			else {
				PhotoPaletteTouch.lastTouch.pageX = touch.pageX;
				PhotoPaletteTouch.lastTouch.pageY = touch.pageY;
			}
		},
		touchItemById: function(touchList, identifier) {
			identifier = identifier || PhotoPaletteTouch.startTouch.identifier;
			for (var i=0; i<touchList.length; i++)
				if (touchList[i].identifier == identifier)
					return touchList[i];
			return null;
		},
		touchmove: function(ev) {
				var newTouch = this.touchItemById(ev.changedTouches);
			if (!newTouch) {
				console.log('touchmove ignored');
				return;
			}
			var topDiff = newTouch.pageY - this.lastTouch.pageY;
			var leftDiff = newTouch.pageX - this.lastTouch.pageX;
//			console.log("Y: " + newTouch.pageY + " X" + newTouch.pageX);
//			console.log("oldY: " + PhotoPaletteTouch.lastTouch.pageY + " old X" + PhotoPaletteTouch.lastTouch.pageX);
//			console.log("topDiff: " + topDiff + " leftDiff" + leftDiff);
			this.dragImage.css({
				top: "+=" + topDiff,
				left: "+=" + leftDiff
			});
			this.setLastTouch(newTouch);
//			console.log('touchmove');
			ev.preventDefault();
		},
		touchend: function(ev) {
			console.log('touchend');
			var newTouch = PhotoPaletteTouch.touchItemById(ev.changedTouches);
			if (!newTouch) {
				console.log('touchend ignored');
				return;
			}
			this.cancelTouch();
			console.log('touchend');
			ev.preventDefault();
		},
		touchcancel: function(ev) {
			ev = ev.originalEvent;
			if (this.touchItemById(ev.changedTouches)) {
				this.cancelTouch();
				console.log('touchcancel');
				ev.preventDefault();
			}
			else
				console.log('touchcancel ignored');
		}
	}

	if (PB.detectTouch()) {
		$.extend(PhotoPalette, PhotoPaletteTouch);
	}
	else
		$.extend(PhotoPalette, PhotoPaletteDnd);

	window.PhotoPalette = PhotoPalette;
})(window.GUI);


(function(window) {
	var WimpShortcut = function(name, key, meta, callback) {
		this.name = name;
		this.key = key;
		this.meta = meta;
		this.callback = callback;
	};

	var shortcuts = null;	// hash of shortcuts
	var commands = {};

	$.extend(WimpShortcut, {
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
		add: function(shortcut) {
			if (shortcuts == null) {
				$('body').keypress( function(ev) {
					ev = ev.originalEvent;
					if (ev.repeat)
						return;
					var key = ev.char || ev.charCode || ev.which;
					var s = WimpShortcut.hashString(key, ev.altKey);	// TODO revise for windows
	//				console.log('shortcut: ', s);
					if (shortcuts[s])
						shortcuts[s].callback();
				});
				shortcuts = {};
			}
			if (shortcut.key)
				shortcuts[WimpShortcut.hashString(shortcut.key, shortcut.meta)] = shortcut;
			if (shortcut.name)
				commands[shortcut.name] = shortcut;
		},
		doCommand: function(cmd ) {
			if (commands[cmd])
				commands[cmd].callback();
			else
				console.error('unknown command ' + cmd);
		}
	});
	window.WimpShortcut = WimpShortcut;
})(window);

// GUI.Controller
(function(window) {

	var navbarHeight = 41; // @navbar-height in less
	// Image palette variables
	var baseImageHeight = 128; 	// @image-height
	var imagePadding = 12;			// @image-padding
	var imageHeight = baseImageHeight;
	var imageHeightScaler = 1.1;

	var Controller = {

		// Grow photo-list-container
		setContainerHeight: function(height, animate) {
			var paletteHeight = navbarHeight + height;
			var newProps = [
				['#palette-tabs-container .tab-pane', 'max-height', height],
				['#pb-palette', 'height', paletteHeight],
				['#pb-work-area', 'padding-top', paletteHeight],
				['#work-area-tools', 'padding-top', paletteHeight]
			]
			newProps.forEach(function(arry) {
				if (animate) {
					var o = {};
					o[arry[1]] = arry[2];
					$(arry[0]).animate(o, 100);
				}
				else
					$(arry[0]).css(arry[1], arry[2]);
			});
		},
		setImageHeight: function(height) {
			var scale = height / imageHeight;
			$('#photo-list-container img').each(function() {
				var el = $(this);
				el.stop();
				var nh = el.height() * scale;
				var nw = el.width() * scale;
				el.css('height', nh);
				el.css('width', nw);
			});
			imageHeight = height;
			// find the smallest size that encloses images
		},
		renumberRoughPages: function() {
			$('#work-area-rough .rough-page').each(function(idx) {
				if (idx < 4)
					return;
				var pNum = idx - 3;
				$(this).children('p').text(idx - 3);
				if (pNum % 2 == 1)
					$(this).removeClass('left-rough').addClass('right-rough');
				else
					$(this).removeClass('right-rough').addClass('left-rough');
			});
		},
		revealByScrolling: function(el, container) {
			el = $(el).get(0);
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
		tileRoughInsideTiles: function (roughDiv) {
			roughDiv = $(roughDiv);
			var tiles = roughDiv.children('.rough-tile');
			var totalWidth = roughDiv.width();
			var totalHeight = roughDiv.height() - roughDiv.children('p').height();
			var tileCount = tiles.length;
			// Perfect fit edge length
			var edgeLength = Math.floor(Math.sqrt(totalWidth * totalHeight / tileCount));
			// shrink the edge until all tiles fit
			// Number of tiles that fits: floor(width / edge) * floor(height / edge)
			while (edgeLength > 8
				&& (Math.floor(totalWidth / edgeLength) * Math.floor(totalHeight / edgeLength)) < tileCount)
				edgeLength -= 1;
			tiles.animate({height: edgeLength + 'px', width: edgeLength + 'px'});
		},
		getPossiblePhotoContainerHeights: function(imageHeight) {
			$('#photo-list-container').stop();
			var max = $('body').height() - 200;
			var curr = imageHeight + imagePadding;
			var all = [ curr ];
			while ((curr += imageHeight) < max)
				all.push( curr);
			return all;
		},
		viewMoreImages: function() {
			var sizes = this.getPossiblePhotoContainerHeights(imageHeight);
			var height = $('#photo-list-container').height();
			for (var i=0; i< sizes.length; i++) // find next larger size
				if (sizes[i] > height) {
					this.setContainerHeight(sizes[i], true);
					return;
				}
		},
		viewFewerImages: function() {
			var sizes = this.getPossiblePhotoContainerHeights(imageHeight);
			var height = $('#photo-list-container').height();
			for (var i=sizes.length -1; i >= 0; i--) // find previous smaller size
				if (sizes[i] < height) {
					this.setContainerHeight(sizes[i], true);
					return;
				}
		},
		viewBiggerImages: function() {
			var nextImgSize = Math.floor(imageHeight * imageHeightScaler);
			if (nextImgSize < 256) {
				this.setImageHeight(nextImgSize);
				this.viewMoreImages();
			}
		},
		viewSmallerImages: function() {
			var nextSize = Math.floor(imageHeight / imageHeightScaler);
			if (nextSize > baseImageHeight / 2) {
				this.setImageHeight(nextSize);
				this.viewFewerImages();
			}
		},
		addRoughPage: function(targetPage, direction) {
			direction = direction || 'after';
			targetPage = targetPage || $('#work-area-rough > .rough-page:last').get(0);
			var pos = 'right';
			var pageNumber = 0;
			if (targetPage && targetPage.className.match(/right/))
				pos = 'left';
			var newPage = $("<div class='rough-page " + pos +"-rough'><p>" + pageNumber + "</p></div>");
			if (targetPage) {
				if (direction == 'before')
					$(targetPage).before(newPage);
				else
					$(targetPage).after(newPage);
			}
			else {
				$('#work-area-rough').append(newPage);
			}
			// cleanup: make it look nice
			window.GUI.RoughWorkArea.makeDraggable(newPage);
			this.revealByScrolling(newPage, $('#pb-work-area'));
			this.renumberRoughPages();
		},
		removeRoughPage: function(roughPage) {
			$(roughPage).animate({width:0}, function() {
				$(roughPage).detach();
				Controller.renumberRoughPages();
			});
		},
		removeImage: function(image) {
			$(image).animate({width: 0}, function() {
				$(image).detach();
			});
		},
		removeRoughImage: function(roughImage) {
			roughImage = $(roughImage);
			var parent = $(roughImage).parent();
			roughImage.animate({width:0}, function() {
				roughImage.detach();
				Controller.tileRoughInsideTiles(parent);
			});
		}
	};

	window.Controller = Controller;

})(window.GUI);

// Rough work area drag and drop handling
// Implements:
// Drag sources:
// Rough page
// Rough page image
// Drag destinations:
// Rough page
(function(window) {
	var roughPageTarget = { target: null, direction: 0, dropFeedback: "" };

	var RoughPageImageDnd = {
		makeDraggable: function(el) {
			$(el).prop('draggable', true).on( {
				dragstart: function(ev) {
//					console.log("DragStore.start rough-page-image");
					ev = ev.originalEvent;
					ev.dataTransfer.setData('text/plain', this.src);// chrome does not work without this
					ev.dataTransfer.setData('text/uri-list', this.src);
					DragStore.start().roughImage = this;
					ev.dataTransfer.effectAllowed = 'move';
					ev.stopPropagation();
				},
				dragend: function(ev) {
//					console.log("DragStore.clear rough-page-image");
					DragStore.clear();
					ev.stopPropagation();
				}
			});
		}
	}

	var RoughWorkArea = {
		init: function() {
			this.makeDroppable();
			this.makeDraggable($('.rough-page'));
		}
	};

	var RoughWorkAreaDnd = {
		makeDroppable: function() {
			$('#work-area-rough').prop('dropzone', true).on( {
				dragover: this.dragover,
				dragleave: this.dragleave,
				drop: this.drop,
				dragenter: this.dragenter
			});
		},
		makeDraggable: function(el) {	// makes rough-page draggable
			$(el).prop('draggable', true).on( {
				'dragstart': function(ev) {
					ev = ev.originalEvent;
					ev.dataTransfer.setData('text/plain', "my text");
//					console.log("DragStore.start rough-page");
					DragStore.start().roughPage = this;
					// TODO hide the page, create drag image from canvas
		//			ev.dataTransfer.setDragImage(clone, 0, 0);
					ev.dataTransfer.effectAllowed = "move";
				},
				'dragend': function(ev) {
//					console.log("DragStore.clear rough-page");
					DragStore.clear();
				}
			});
		},
		logTargets: function(prefix, ev) {
			var s = prefix;
			if (ev.target)
				s += ' target: ' + ev.target.id + ' ' + ev.target.className;
			else
				s += ' target: null';
			if (ev.currentTarget)
				s += ' current: ' + ev.currentTarget.id + ' ' + ev.currentTarget.className;
			else
				s += ' current: null';
			console.log(s);
		},
		dragenter: function(ev) {
			ev = ev.originalEvent;
			ev.stopPropagation();
			ev.preventDefault();
		},
		dragover: function(ev) {
			ev = ev.originalEvent;
			// Ignore unless drag has the right flavor
			if (!(DragStore.roughPage
				|| DragStore.image
				|| DragStore.addRoughPage
				|| DragStore.roughImage))
				return;
			ev.preventDefault();
			// Find the current drop location
			var newTarget = null;
			var newDirection = null;
			$(ev.currentTarget).children('.rough-page').each(function() {
				var direction = GUtil.pointInClientRect(ev.pageX, ev.pageY,
					this.getBoundingClientRect());
				if (direction) {
					newTarget = this;
					newDirection = direction;
					return false;
				}
			});
			// Display visual feedback
			if (DragStore.roughPage || DragStore.addRoughPage) {
				if (newTarget) {
					if (newTarget != DragStore.roughPage)
						RoughWorkAreaDnd.setTarget(newTarget, newDirection, 'drop-target');
				}
				else
					RoughWorkAreaDnd.setTarget();
			}
			else if (DragStore.image) {
				if (newTarget)
					RoughWorkAreaDnd.setTarget(newTarget, null, 'drop-target');
				else
					RoughWorkAreaDnd.setTarget();
			}
			else if (DragStore.roughImage) {
				if (newTarget && newTarget != $(DragStore.roughImage).parent('.rough-page').get(0))
					RoughWorkAreaDnd.setTarget(newTarget, null, 'drop-target');
				else
					RoughWorkAreaDnd.setTarget();
			}
		},
		dragleave: function(ev) {
			// This will cause a dragover with an empty target
			RoughWorkAreaDnd.dragover(ev);
		},
		drop: function(ev) {
			ev = ev.originalEvent;
			ev.preventDefault();
			if (!roughPageTarget.target)
				return;
			var t = {target: roughPageTarget.target, direction: roughPageTarget.direction};
			RoughWorkAreaDnd.setTarget();	// reset the drag visuals
			if (DragStore.roughPage) {
				t.target = $(t.target);
				var src = $(DragStore.roughPage);
				// patch the location if src is before destination
				// to preserve visual consistency
				if (src.parent().children().get().indexOf(src.get(0)) <
					t.target.parent().children().get().indexOf(t.target.get(0)))
					t.direction = 'after';

				var oldWidth = src.width();
				src.animate({width: 0}, function() { // hide old
					src.detach();
					if (t.direction == 'before')
						t.target.before(src);
					else
						t.target.after(src);
					src.animate({width: oldWidth}); // show new
					GUI.Controller.renumberRoughPages();
				});
			}
			else if (DragStore.addRoughPage) {
				GUI.Controller.addRoughPage(t.target, t.direction);
			}
			else if (DragStore.image) {
				var src = $(DragStore.image);
				var newImg = $("<div class='rough-tile'/>");
				newImg.css('background-image', 'url("' + src.prop('src') + '")');
				newImg.appendTo(t.target);
				RoughPageImageDnd.makeDraggable(newImg);
				GUI.Controller.tileRoughInsideTiles(t.target);
			}
			else if (DragStore.roughImage) {
				// move image from one rough to another
				var oldParent = $(DragStore.roughImage).parent();
				$(DragStore.roughImage).detach();
				GUI.Controller.tileRoughInsideTiles(oldParent);
				$(t.target).append(DragStore.roughImage);
				GUI.Controller.tileRoughInsideTiles(t.target);
			}
		},
		setTarget:	function (target, direction, dropFeedback) {
			direction = 'before';	// decided to ignore direction for now
			if (roughPageTarget.target == target && roughPageTarget.direction == direction)
				return;
			if (roughPageTarget.target) {
				$(roughPageTarget.target).removeClass(roughPageTarget.dropFeedback);
			}
			roughPageTarget = { target: target, direction: direction, dropFeedback: dropFeedback }
			if (target)
				$(target).addClass(dropFeedback);
		}
	}

	var RoughWorkAreaTouch = {
		makeDraggable: function() {
		},
		makeDroppable: function() {
			$('#work-area-rough').on( {
				'touchmove': function(ev) { RoughWorkAreaTouch.touchmove(ev.originalEvent)},
				'touchend': function(ev) { RoughWorkAreaTouch.touchend(ev.originalEvent)},
			});
		},
		touchmove: function(ev) {
			console.log('#rough-work-area touchmove ');
		},
		touchend: function(ev) {
			console.log('#rough-work-area touchend ');
		}
	}

	if (PB.detectTouch()) {
		$.extend(RoughWorkArea, RoughWorkAreaTouch);
	}
	else
		$.extend(RoughWorkArea, RoughWorkAreaDnd);

	window.RoughWorkArea = RoughWorkArea;
	window.RoughPageImage = RoughPageImageDnd;

})(window.GUI);


// Utilities
(function(window) {
	var GUtil = {
		// false not in rect, 'left' to the left, 'right' to the right
		pointInClientRect: function(x, y, r) {
			var inRect = y >= r.top && y <= r.bottom && x >= r.left && x <= r.right;
			if (inRect) {
				var midpoint = r.left + (r.right - r.left) / 10;
//				console.log(x, ' mid ', midpoint,  x < midpoint ? 'before' : 'after');
				return x < midpoint ? 'before' : 'after';
			}
			else
				return false;
		}
	}
	window.GUtil = GUtil;
})(window);

// DragStore is a global used to store dragged local data
// Why? Html drag can only drag strings, we need js objects
// Drag types are not available dragover callback
(function(window) {
	var DragStore = {
		start: function() {
//			console.log("DragStore.start");
			this._roughPage = null;
			this._image = null;
			this._roughImage = null;
			this._addRoughPage = null;
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
		set roughImage(val) { this._roughImage = val}
	}
	window.DragStore = DragStore;
})(window);

(function(window) {
	var AddRemoveButtons = {
		init: function() {
			$('#add-page-btn').click(function() { GUI.Controller.addRoughPage();});

			$('#add-page-btn').prop('draggable', true).on( {
				dragstart: function(ev) {
					ev = ev.originalEvent;
					ev.dataTransfer.setData('text/plain', "my text");
					DragStore.start().addRoughPage = true;
					ev.dataTransfer.effectAllowed = "move";
				},
				dragend: function(ev) {
					DragStore.clear();
				}
			});

			$('#remove-page-btn').prop('dropzone', true).on( {
				dragover: function(ev) {
					ev = ev.originalEvent;
					ev.preventDefault();
					if (!(DragStore.roughPage
							|| DragStore.image
							|| DragStore.roughImage))
						return;
					$(this).addClass('drop-target');
					ev.stopPropagation();
				},
				dragleave: function(ev) {
					$(this).removeClass('drop-target');
				},
				drop: function(ev) {
					ev.preventDefault();
					ev.stopPropagation();
					$(this).removeClass('drop-target');
					if (DragStore.roughPage)
						GUI.Controller.removeRoughPage(DragStore.roughPage);
					else if (DragStore.image)
						GUI.Controller.removeImage(DragStore.image);
					else if (DragStore.roughImage)
						GUI.Controller.removeRoughImage(DragStore.roughImage);
				}
			});
		}
	}
	window.GUI.AddRemoveButtons = AddRemoveButtons;
})(window);
