// editor.gui.dnd.js

(function(scope) {

"use strict"
	var Draggable = function(el) {
		this.src = el;
	}



	var Events = {
		pageLocation: function($ev) {
			var ev = $ev.originalEvent;
			var retVal;
			if ('targetTouches' in ev)
				retVal = { x: ev.targetTouches[0].pageX,
					y: ev.targetTouches[0].pageY};
			else
				retVal = { x: ev.pageX, y: ev.pageY };
			if (retVal.x == undefined)
				debugger;
//			console.log(retVal.x, retVal.y);
			return retVal;
		}
	}

	var Draggable = function(options) {
		this.options = $.extend( {
			flavors:['test'],
			start: null,
			end: null
		}, options);
	}

	Draggable.prototype = {
		get flavors() {
			return this.options.flavors;
		},
		// Returns drag image
		start: function( $el, ev, startLoc ) {
			if ( this.options.start )
				return this.options.start($el, ev, startLoc);
			else {
				var bounds = $el.get(0).getBoundingClientRect();
				var $dom = GUI.Util.cloneDomWithCanvas($el)
					.addClass('touch-drag-src')
					.removeClass('draggable')
					.css( {
						top: startLoc.y,
						left: startLoc.x,
						marginLeft: bounds.left + window.scrollX - startLoc.x,
						marginTop: bounds.top + window.scrollY - startLoc.y
					});
				$dom.children().css('verticalAlign', 'top'); // eliminate LI whitespace
				return $dom;
			}
		},
		end: function() {

		}
	}


	var Droppable = function(options) {
		this.options = $.extend( {
			flavors: ['test'],
			enter: null,
			leave: null
		}, options);
	}

	Droppable.prototype = {
		get flavors() {
			return this.options.flavors;
		},
		enter: function($el) {
			console.log('dropEnter');
			if (this.options.enter) {
				return this.options.enter($el);
			}
			else {
				$el.addClass('drop-target');
			}
		},
		leave: function($el) {
			console.log('dropLeave');
			if (this.options.leave) {
				return this.options.leave($el);
			}
			else {
				$el.removeClass('drop-target');
			}
		}
	}

	var defaultDroppable = new Droppable();
	var defaultDrag = new Draggable();

	var $src;	// Dom drag source
	var $dest = $();	// Dom drag destination
	var draggable;	// Dnd.Draggable object
	var droppable;	// Dnd.Droppable object
	var $dragImage;	// DOM being dragged
	var startLoc;	// start location of the drag

	var dragBounds = {
		top: 0,
		left: 0,
		bottom: 32000,
		right: 32000
	};

	var Dnd = {
		reset: function() {
			this.setDest($());
			$src = null;
			draggable = null;
			droppable = null;
			$dragImage = null;
			$(document).off('touchmove.dnd mousemove.dnd touchend.dnd mouseup.dnd');
		},
		setDest: function($newDest) {
			if ($dest[0] == $newDest[0])
				return;
			if ($dest.length > 0) {
				droppable.leave($dest);
			}
			$dest = $newDest;
			if ($dest.length > 0) {
				// console.log('dest set');
				droppable = $dest.data('droppable') || defaultDroppable;
				droppable.enter($dest);
			}
			else {
				// console.log('dest removed');
			}
		},
		dragStart: function(ev) {
			if ($dragImage)	// if we get both mousedown and touchstart do only one
				return;
			$src = $(ev.currentTarget);

			// create a clone
			startLoc = Events.pageLocation(ev);
			draggable = $src.data('pb-draggable') || defaultDrag;
			$dragImage = draggable.start( $src, ev, startLoc );
			$(document.body).append($dragImage);

			// set dragging bounds
			var bodySize = document.body.getBoundingClientRect();
			var dragRect = $dragImage[0].getBoundingClientRect();
			dragBounds = {
				top: startLoc.y - dragRect.top,
				left: startLoc.x - dragRect.left,
				bottom: bodySize.height - dragRect.height + startLoc.y - dragRect.top,
				right: bodySize.width - dragRect.width + startLoc.x - dragRect.left
			};
			// tracking events
			$(document).on('touchmove.dnd mousemove.dnd', Dnd.dragMove);
			$(document).on('touchend.dnd mouseup.dnd', Dnd.dragEnd);
		},
		matchFlavors: function(srcFlavors, destFlavors) {
			for (var i=0; i<srcFlavors.length; i++) {
				if (destFlavors.indexOf( srcFlavors[i] ) != -1)
					return srcFlavors[i];
			}
			return null;
		},
		findDroppable: function($ev) {
			// This function was hand-tuned to prevent crashes/hangs in iOS
			var hidden = [];
			function hide(hideEl) {
				hideEl.style.visibility = 'hidden';
				hidden.push(hideEl);
			}
			function restoreHidden() {
				while (hidden.length)
					hidden.pop().style.visibility = 'visible';
			}
			var loc = Events.pageLocation($ev);
			var scrollTop = window.scrollY;
			var scrollLeft = window.scrollX;
			var el = document.elementFromPoint( loc.x - scrollLeft,
													loc.y - scrollTop );
			while (el && el.nodeName != 'BODY' && el.nodeName != 'HTML') {
				var $el = $(el);
				if ($el.hasClass('pb-droppable')) {
					var droppable = $el.data('droppable');
					if (droppable == null) {
				// 		// console.warn('.pb-droppable must have data(droppable)');
				 		droppable = defaultDroppable;
				 	}
				 	if ( this.matchFlavors(draggable.flavors, droppable.flavors) ) {
				 		restoreHidden();
				 		return $el;
				 	}
				}
				hide(el);
				el = document.elementFromPoint( loc.x - scrollLeft,
												loc.y - scrollTop );
			}
			restoreHidden();
			return $();
		},
		dragMove: function($ev) {
			// console.log('dragMove enter');
			$ev.preventDefault(); // stop touch scrolling
			var loc = Events.pageLocation($ev);
			loc.x = Math.max( Math.min( loc.x, dragBounds.right ), dragBounds.left);
			loc.y = Math.max( Math.min( loc.y, dragBounds.bottom), dragBounds.top);
			$dragImage.css( {
				top: loc.y,
				left: loc.x
			});
			var $newDest = Dnd.findDroppable($ev);
			Dnd.setDest($newDest);
			// console.log('dragMove leave');
		},
		// return true if transfer successful
		doTransfer: function(ev) {

			return true;
		},
		dragEnd: function(ev) {
			console.log('dragEnd');

			var transferDone = false;
			if ($dest.length > 0)
				transferDone = Dnd.doTransfer(ev);
			if (transferDone) {
				$dragImage.remove();
			}
			else {
				var $di = $dragImage;
				$di.transition({
					top: startLoc.y,
					left: startLoc.x,
					duration: 150,
					complete: function() { $di.remove();}
				});
			}
			draggable.end(!springBack);
			Dnd.reset();
		}
	}

	$(document).on('touchstart.dnd mousedown.dnd', ".pb-draggable", Dnd.dragStart );
	scope.Dnd = {
		Draggable: Draggable,
		Droppable: Droppable
	};
})(GUI);
