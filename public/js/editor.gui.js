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
(function(scope){
	var PhotoPalette = {
	}

	var PhotoPaletteDnd = {
		makeDraggable: function(img) {
			$(img).attr('draggable', true).on( {
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


(function(scope) {
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
	scope.WimpShortcut = WimpShortcut;
})(window);

// GUI.Controller
(function(scope) {

	var navbarHeight = 41; // @navbar-height in less
	// Image palette variables
	var baseImageHeight = 128; 	// @image-height
	var imagePadding = 12;			// @image-padding
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
			var roughPage = $(roughPage).get(0);
			var r = roughPage.getBoundingClientRect();
			var retVal = { dom: $(roughPage).get(0), type: 'roughPage',
				offsetX: clientX - r.left, offsetY: clientY - r.top }
			$(roughPage).children().each(function() {
				var r = this.getBoundingClientRect();
				if ( scope.GUtil.pointInClientRect(clientX, clientY, r)) {
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
				var direction = scope.GUtil.pointInClientRect(ev.clientX, ev.clientY,
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
						this.setTarget(newTarget, newDirection, 'drop-target');
				}
				else
					this.setTarget();
			}
			else if (DragStore.image) {
				if (newTarget)
					this.setTarget(newTarget, null, 'drop-target');
				else
					this.setTarget();
			}
			else if (DragStore.roughImage) {
				if (newTarget && newTarget != $(DragStore.roughImage).parent('.rough-page').get(0))
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
					scope.GUtil.moveNode(src, t.target, t.direction);
					// src.detach();
					// if (t.direction == 'before')
					// 	t.target.before(src);
					// else
					// 	t.target.after(src);
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
			DragStore.hadDrop = true;
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
					DragStore.start()[target.type] = target.dom;
					// TODO hide the page, create drag image from canvas
					ev.dataTransfer.setDragImage(target.dom, target.offsetX, target.offsetY);
					ev.dataTransfer.effectAllowed = "move";
				},
				'dragend': function(ev) {
//					console.log("DragStore.clear rough-page");
					DragStore.clear();
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

(function(scope) {
	var AddRemoveButtons = {
		init: function() {
			var addBtn = $('#add-page-btn');
			addBtn.click(function() { GUI.Controller.addRoughPage();});

			if (PB.detectTouch())
				scope.TouchDragHandler.makeDraggable(addBtn, 'addRoughPage');
			else
				addBtn.attr('draggable', true).on( {
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

			$('#remove-page-btn').attr('dropzone', true).on( {
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
	scope.AddRemoveButtons = AddRemoveButtons;
})(window.GUI);

// Graphics utilities
(function(scope) {
	var GUtil = {
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


	scope.GUtil = GUtil;
})(window.GUI);

// TouchDrop: transfroms touch events into drag and drop events
(function(scope) {

	var dropTarget;

	var TouchDrop = {
		findTarget: function(clientX, clientY) {
			var targets = $('[dropzone]').get().filter(function(el) {
				var r = el.getBoundingClientRect();
				return clientY >= r.top && clientY <= r.bottom && clientX >= r.left && clientX <= r.right;
			});
			switch(targets.length) {
				case 0: return null;
				case 1: return targets[0];
				default: console.log('multiple drop targets'); return targets[0];
			}
		},
		sendEvent: function(target, eventType, clientX, clientY) {
			if (!target)
				return;
			var ev = {
				preventDefault: function() {},
				stopPropagation: function() {},
				clientX: clientX,
				clientY: clientY,
				currentTarget: target
			}
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
	}
	scope.TouchDrop = TouchDrop;
})(window.GUI);

(function(scope) {

	var TouchTrack = function(findTargetCb) {
		if (typeof findTargetCb == 'string')
		{
			var targetType = findTargetCb;
			findTargetCb = function(element, clientX, clientY) {
				element = $(element).get(0);
				var r = element.getBoundingClientRect();
				return { dom: element, type: targetType,
					offsetX: clientX - r.left, offsetY: clientY - r.top }
			}
		}
		this._findTargetCb = findTargetCb;
		this._start = null; // first touch event
		this._last = { clientX: 0, clientY: 0}; // location of last touch event
		this._domCopy = null; // clone of the element we are dragging
		this._source = null; // element we are dragging
		this._delayed = false;	// delayed start of tracking, holds id of delayTimeotu
	}

	TouchTrack.prototype = {
		startTracking: function(element, touchEvent, delayed) {
			this.start = touchEvent;
			this.last = touchEvent;
			this.findSource(element, touchEvent.clientX, touchEvent.clientY);
			var THIS = this;
			function finishStart() {
				THIS.createDragImage();
				DragStore.start();
				DragStore[THIS._source.type] = THIS._source.dom;
				THIS._delayed = false;
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
			if (!DragStore.hadDrop) {
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
			this._source = null;
		},
		createDragImage: function(touchTrack) {
			var r = this._source.dom.getBoundingClientRect();
			this.domCopy = $(this._source.dom).clone();
			this.domCopy.addClass('touch-drag-src')
				.css({
				position: 'absolute',
//				top:0, left:0, width: '100px', height: '100px'
				top: r.top, left: r.left, width: r.width, height: r.height
			});
			$('body').append(this._domCopy);
		},

		findSource: function(element, clientX, clientY) {
			this._source = this._findTargetCb(element, clientX, clientY);
		},

		get identifier() { return this._start.identifier; },
		get delayed() { return this._delayed; },

		get last() { return this._last },
		set last(touchEvent) {
			if (touchEvent) {
				this._last.clientX = touchEvent.clientX;
				this._last.clientY = touchEvent.clientY
			}
			else
				this._last = {}
		},

		get start() { return this._start; },
		set start(touchEvent) {
			this._start = touchEvent;
		},

		get domCopy() { return this._domCopy },
		set domCopy(el) {
			if (this._domCopy)
				this._domCopy.stop().detach();
			this._domCopy = el;
		}
	}
	var TouchDragHandler = {
		makeDraggable: function(el, findTargetCb) {

			var touchTrack = new TouchTrack(findTargetCb);
			$(el).attr('draggable', true).on({
				touchstart: function(ev) { TouchDragHandler.touchstart(ev.originalEvent, touchTrack)},
				touchmove: function(ev) { TouchDragHandler.touchmove(ev.originalEvent, touchTrack)},
				touchend: function(ev) { TouchDragHandler.touchend(ev.originalEvent, touchTrack)},
				touchcancel: function(ev) { TouchDragHandler.touchcancel(ev.originalEvent, touchTrack)}
			});
		},
		touchItemById: function(touchList, identifier) {
			for (var i=0; i<touchList.length; i++)
				if (touchList[i].identifier == identifier)
					return touchList[i];
			return null;
		},
		touchstart: function(ev, touchTrack) {
			//console.log('touchstart', ev.currentTarget);
			if (ev.touches.length > 1)
				return;
			touchTrack.startTracking(ev.currentTarget,
				ev.touches[0],
				$(ev.currentTarget).data('events').click);
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
			if (touchTrack.delayed && $(ev.target).data('events').click) {
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
		set roughImage(val) { this._roughImage = val},
		get hadDrop() { return this._hadDrop },
		set hadDrop(val) { this._hadDrop = val }
	}
	window.DragStore = DragStore;
})(window);


