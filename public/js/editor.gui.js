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

*/
"use strict";


(function(window) {
	window.GUI = {
		init: function() {
			this.Buttons.init();
			this.CommandManager.init();
			this.PhotoPalette.init();
			this.RoughWorkArea.init();
		}
	};
	window.PB = {
		// True if we are on touch device
		detectTouch: function() {
			return 'ontouchstart' in window;
		}
	};

})(window);

// PhotoPalette
// images can be dragged out
(function(scope){
	var PhotoPalette = {
		init: function() {
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

	if (PB.detectTouch()) {
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

// GUI.Controller
(function(scope) {

	var navbarHeight = 41; // @navbar-height in less
	// Image palette variables
	var baseImageHeight = 128; 	// @image-height
	var imagePadding = 8;			// @image-padding
	var imageHeight = baseImageHeight;
	var imageHeightScaler = 1.1;
	var roughPageHeight = 128;

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
			var max = Math.min($('body').height() - 200, $('#photo-list').height() + imagePadding + 12 + 8);
			var curr = 8 + imageHeight + imagePadding / 2;
			var all = [ curr ];
			while ((curr += imageHeight + imagePadding) < max)
				all.push( curr);
			return all;
		},
		getMinMaxPaletteHeight: function() {
			var possible = this.getPossiblePhotoContainerHeights(imageHeight);
			return { min: possible[0], max: possible[possible.length -1]}
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
			newPage.css('height', 0);
			if (targetPage) {
				if (direction == 'before')
					$(targetPage).before(newPage);
				else
					$(targetPage).after(newPage);
			}
			else {
				$('#work-area-rough').append(newPage);
			}
			newPage.animate({height: roughPageHeight},function() {
				newPage.css('display', 'auto');
				Controller.revealByScrolling(newPage, $('#pb-work-area'));
			});

			// cleanup: make it look nice
			scope.RoughWorkArea.makeDraggable(newPage);
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

	scope.Controller = Controller;
})(window.GUI);

// Rough work area drag and drop handling
// Implements:
// Drag sources:
// Rough page
// Rough page image
// Drag destinations:
// Rough page
(function(scope) {
	var roughPageTarget = { target: null, direction: 0, dropFeedback: "" };

	var RoughWorkArea = {
		init: function() {
			this.makeDroppable();
			$('.rough-page').each(function() {
				RoughWorkArea.makeDraggable(this);
			});
		},
		getDragTarget: function(roughPage, clientX, clientY) {
			roughPage = $(roughPage).get(0);
			var r = roughPage.getBoundingClientRect();
			var retVal = { dom: $(roughPage).get(0), type: 'roughPage',
				offsetX: clientX - r.left, offsetY: clientY - r.top }
			$(roughPage).children().each(function() {
				var r = this.getBoundingClientRect();
				if ( scope.Util.pointInClientRect(clientX, clientY, r)) {
					if ($(this).hasClass('rough-tile')) {
						retVal.dom = this;
						retVal.type = 'roughImage';
						retVal.offsetX = clientX - r.left;
						retVal.offsetY = clientY - r.top;
					}
				}
			});
			return retVal;
		},
		makeDroppable: function() {
			$('#work-area-rough').attr('dropzone', true).on( {
				dragover: function(ev) { RoughWorkArea.dragover(ev.originalEvent) },
				dragleave: function(ev) { RoughWorkArea.dragleave(ev.originalEvent) },
				drop: function(ev) { RoughWorkArea.drop(ev.originalEvent) },
				dragenter: function(ev) { RoughWorkArea.dragenter(ev.originalEvent) }
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
			ev.stopPropagation();
			ev.preventDefault();
		},
		dragover: function(ev) {
			// Ignore unless drag has the right flavor
			if (!(scope.DragStore.roughPage
				|| scope.DragStore.image
				|| scope.DragStore.addRoughPage
				|| scope.DragStore.roughImage))
				return;
			ev.preventDefault();
			// Find the current drop location
			var newTarget = null;
			var newDirection = null;
			$(ev.currentTarget).children('.rough-page').each(function() {
				var direction = scope.Util.pointInClientRect(ev.clientX, ev.clientY,
					this.getBoundingClientRect());
				if (direction) {
					newTarget = this;
					newDirection = direction;
					return false;
				}
			});
			// Display visual feedback
			if (scope.DragStore.roughPage || scope.DragStore.addRoughPage) {
				if (newTarget) {
					if (newTarget != scope.DragStore.roughPage)
						this.setTarget(newTarget, newDirection, 'drop-target');
				}
				else
					this.setTarget();
			}
			else if (scope.DragStore.image) {
				if (newTarget)
					this.setTarget(newTarget, null, 'drop-target');
				else
					this.setTarget();
			}
			else if (scope.DragStore.roughImage) {
				if (newTarget && newTarget != $(scope.DragStore.roughImage).parent('.rough-page').get(0))
					this.setTarget(newTarget, null, 'drop-target');
				else
					this.setTarget();
			}
		},
		dragleave: function(ev) {
			// This will cause a dragover with an empty target
			this.dragover(ev);
		},
		drop: function(ev) {
			ev.preventDefault();
			if (!roughPageTarget.target)
				return;
			var t = {target: roughPageTarget.target, direction: roughPageTarget.direction};
			this.setTarget();	// reset the drag visuals
			if (scope.DragStore.roughPage) {
				t.target = $(t.target);
				var src = $(scope.DragStore.roughPage);
				// patch the location if src is before destination
				// to preserve visual consistency
				if (src.parent().children().get().indexOf(src.get(0)) <
					t.target.parent().children().get().indexOf(t.target.get(0)))
					t.direction = 'after';

				var oldWidth = src.width();
				src.animate({width: 0}, function() { // hide old
					scope.Util.moveNode(src, t.target, t.direction);
					// src.detach();
					// if (t.direction == 'before')
					// 	t.target.before(src);
					// else
					// 	t.target.after(src);
					src.animate({width: oldWidth}); // show new
					GUI.Controller.renumberRoughPages();
				});
			}
			else if (scope.DragStore.addRoughPage) {
				GUI.Controller.addRoughPage(t.target, t.direction);
			}
			else if (scope.DragStore.image) {
				var src = $(scope.DragStore.image);
				var newImg = $("<div class='rough-tile'/>");
				newImg.css('background-image', 'url("' + src.prop('src') + '")');
				newImg.appendTo(t.target);
				GUI.Controller.tileRoughInsideTiles(t.target);
			}
			else if (scope.DragStore.roughImage) {
				// move image from one rough to another
				var oldParent = $(scope.DragStore.roughImage).parent();
				$(scope.DragStore.roughImage).detach();
				GUI.Controller.tileRoughInsideTiles( oldParent );
				$(t.target).append( scope.DragStore.roughImage );
				GUI.Controller.tileRoughInsideTiles(t.target);
			}
			scope.DragStore.hadDrop = true;
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
	};

	var RoughWorkAreaDnd = {
		makeDraggable: function(el) {	// makes rough-page draggable
			$(el).attr('draggable', true).on( {
				'dragstart': function(ev) {
					ev = ev.originalEvent;
					var target = RoughWorkArea.getDragTarget(this, ev.clientX, ev.clientY);
					ev.dataTransfer.setData('text/plain', "page drag");
					console.log("dragstart rough-page");
					scope.DragStore.start()[target.type] = target.dom;
					// TODO hide the page, create drag image from canvas
					ev.dataTransfer.setDragImage(target.dom, target.offsetX, target.offsetY);
					ev.dataTransfer.effectAllowed = "move";
				},
				'dragend': function(ev) {
//					console.log("DragStore.clear rough-page");
					scope.DragStore.clear();
				}
			});
		}
	}

	var RoughWorkAreaTouch = {
		makeDraggable: function(el) {
			$(el).each(function() {
				var src = this;
				scope.TouchDragHandler.makeDraggable(src, function(element, clientX, clientY) {
					return RoughWorkArea.getDragTarget(element, clientX, clientY);
				});
			});
		}
	}

	if (PB.detectTouch()) {
		$.extend(RoughWorkArea, RoughWorkAreaTouch);
	}
	else {
		$.extend(RoughWorkArea, RoughWorkAreaDnd);
	}
	scope.RoughWorkArea = RoughWorkArea;

})(window.GUI);


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
			var events = src.data('events');
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
			this._roughPage = null;
			this._image = null;
			this._roughImage = null;
			this._addRoughPage = null;
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


