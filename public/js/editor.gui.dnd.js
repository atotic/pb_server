// editor.gui.dnd.js

/*
	Dnd module implements drag'n'drop framework

	Draggable elements:
	- class: pb-draggable
	- implement Draggable interface in object stored in data('pb-draggable')

	Droppable elements:
	- class: pb-droppable
	- implement Droppable inteface in object stored in data('pb-droppable')

	Draggable and Droppable interfaces have default implementations that delegate
	to options.

	Tricky code alert: Droppable HANDOFF

	Some droppables replace their dom with new dom as part of their user feedback.
	This causes trouble, because one droppable gets replaced by another.
	Without handoff, we get stuck in infinite loop:
	drop.enter -> delete dom -> drop.leave -> newDrop.enter -> delete dom -> drop.leave etc. etc

	To prevent this, droppable can hand off data to next droppable on leave.

	If new droppable gets handoff data on enter, and it is same model, it can prevent
	animation,see PhotoDroppable enter/leave for example
*/
(function(scope) {
"use strict"

	// Droppable is a delegate-style class that gets assigned to data('pb-droppable')
	// See HANDOFF comment above
	var Droppable = function(options) {
		this.options = $.extend( {
			flavors: ['test'],
			enter: null,
			leave: null,
			putTransferData: null
		}, options);
	}

	Droppable.prototype = {
		get flavors() {
			return this.options.flavors;
		},
		enter: function($dom, flavor, transferData, handoff) {
			// console.log('dropEnter');
			if (this.options.enter) {
				return this.options.enter($dom, flavor, transferData, handoff);
			}
			else {
				this.dropEl = $dom;
				this.dropEl.addClass('drop-target');
			}
		},
		move: function($ev, flavor) {
			if (this.options.move)
				this.options.move($ev, flavor);
		},
		leave: function(handoffId) {
			// console.log('dropLeave');
			if (this.options.leave) {
				return this.options.leave(handoffId);
			}
			else {
				this.dropEl.removeClass('drop-target');
			}
		},
		putTransferData: function(ev, flavor, data) {
			if (this.options.putTransferData)
				return this.options.putTransferData(ev, flavor, data);
			switch(flavor) {
				case 'test':
					console.warn(data);
				break;
				default:
					console.error("putTransferData not implemented", flavor);
			}
		}
	}

	var Draggable = function(options) {
		this.options = $.extend( {
			flavors:['test'],
			start: null,
			end: null,
			doubleClick: null,
			getTransferData: null
		}, options);
	}

	// Draggable is a delegate-style class that gets assigned to data('pb-draggable')
	Draggable.prototype = {
		get flavors() {
			return this.options.flavors;
		},
		sanitizeDragDom: function($dom) {
			$dom.removeClass('pb-draggable')
				.removeClass('pb-droppable');
			GUI.Dnd.Util.preventDefaultDrag($dom);
			return $dom;
		},
		// Returns drag image
		start: function( $el, $ev, startLoc ) {
			var $dom;
			if ( this.options.start )
				$dom = this.options.start($el, $ev, startLoc);
			if (!$dom) {
				var bounds = $el[0].getBoundingClientRect();
				$dom = GUI.Util.cloneDomWithCanvas($el)
					.addClass('touch-drag-src')
					.css( {
						top: startLoc.y + 2,
						left: startLoc.x + 2,
						marginLeft: bounds.left + $(document).scrollLeft() - startLoc.x,
						marginTop: bounds.top + $(document).scrollTop() - startLoc.y,
						position: 'absolute'
					});
				$dom.children().css('verticalAlign', 'top'); // eliminate LI whitespace
			}
			return this.sanitizeDragDom($dom);
		},
		end: function(transferDone, $ev) {
			if ( this.options.end )
				this.options.end(transferDone, $ev);
		},
		getTransferData: function($src, flavor) {
			if (this.options.getTransferData)
				return this.options.getTransferData($src, flavor);

			switch(flavor) {
				case 'test':
					return 'test';
				default:
					console.error("getTransferData not implemented", flavor);
					return null;
			}
		},
		doubleClick: function($ev) {
			if (this.options.doubleClick) {
				this.options.doubleClick($ev);
				return true;
			}
			console.log("doubleClick");
		}
	}

	var Util = {
		noDragFn: function($ev) {
			console.log("no drag dammit!");
			$ev.preventDefault()
		},
		preventDefaultDrag: function($dom) {
			var nodeName = $dom.prop('nodeName');
			if (nodeName == 'IMG' || nodeName == 'A')
				$dom.on('dragstart', this.noDragFn);
			$dom.find('img,a').on('dragstart', this.noDragFn);
		},
		filterFileList: function(dragFileList, mimeRegex) {
			// returns array of files whose mime type matches, defaults to images
			mimeRegex = mimeRegex || "image/(png|jpeg|gif)";
			var retVal = [];
			for (var i=0; i<dragFileList.length; i++) {
				var f = dragFileList.item(i);
				if (f.type.match( mimeRegex ))
					retVal.push(f);
			}
			return retVal;
		}
	}

	var testDroppable = new Droppable();
	var testDraggable = new Draggable();

	var $src;	// Dom drag source
	var previousDraggable; // Last draggable
	var startTime = 0;
	var $dest = $();	// Dom drag destination
	var draggable;	// Dnd.Draggable object
	var droppable;	// Dnd.Droppable object
	var $dragImage;	// DOM being dragged
	var startLoc;	// start location of the drag
	var transferFlavor;


	var dragBounds = {
		top: 0,
		left: 0,
		bottom: 32000,
		right: 32000
	};

	/*
	Jun-2013 Webkit bug:
	touchmove event will stop firing if the element dragged is detached from dom during drag
	this makes for very choppy photo dragging.
	Workaround: during drag, do not remove elements, move them to hidden div instead
				remove all elements at once when drag is done
	This is done by patching jQuery.remove
	*/
	var webkitIpadBugWorkaround = {
		patchedRemove: function(selector, keepData) {	// jquery: 5421
			var elem,
				elems = selector ? jQuery.filter( selector, this ) : this,
				i = 0;
				for ( ; (elem = elems[i]) != null; i++ ) {
					// hiding ourselves from selectors
					elem.className = '';
					$(elem).removeData();
					$(elem).find('*').attr('class', '').removeData();
					// move to dead dom
					webkitIpadBugWorkaround.remove_container.append(elem);
				}

				return this;
		},
		startFix: function() {
			if ('original_remove' in $.fn)
				return;
			this.remove_container = $("<div id='remove_container' style='display:none'>");
			$(document.body).append( this.remove_container );
			$.fn.original_remove = $.fn.remove;
			$.fn.remove = this.patchedRemove;
		},
		endFix: function() {
			if (! ('original_remove' in $.fn))
				return;
			$.fn.remove = $.fn.original_remove;
			delete $.fn.original_remove;
			this.remove_container.remove();
		}
	}

	var Dnd = {
		reset: function() {
			this.setDest($());
			$src = null;
			draggable = null;
			droppable = null;
			$dragImage = null;
			$(document.body).off('touchmove.dnd mousemove.dnd touchend.dnd mouseup.dnd');
		},
		setDest: function($newDest) {
			if ($dest[0] == $newDest[0])
				return;
			var handoff;
			if ($dest.length > 0) {
				handoff = droppable.leave($newDest.data('model_id'));
			}
			$dest = $newDest;
			if ($dest.length > 0) {
				// console.log('dest set');
				droppable = $dest.data('pb-droppable');
				if (droppable == null) {
					console.warn('droppable without data');
					$dest = $();
					return;
				}
				try {
					droppable.enter($dest, transferFlavor, draggable.getTransferData($src, transferFlavor), handoff );
				}
				catch(ex) {
					droppable = null;
					$dest = $();
				}
			}
			else {
				// console.log('dest removed');
			}
		},
		clearWindowSelection: function() {	// FF can select on user drag
			if (window.getSelection) {
				if (window.getSelection().empty) {  // Chrome
					window.getSelection().empty();
				} else if (window.getSelection().removeAllRanges) {  // Firefox
					window.getSelection().removeAllRanges();
				}
			} else if (document.selection) {  // IE?
				document.selection.empty();
			}
		},
		dragStart: function($ev) {
			// console.log("dragStart", $ev.type);
			webkitIpadBugWorkaround.startFix();
			if ($dragImage)	// if we get both mousedown and touchstart do only one
				return;
			$src = $($ev.currentTarget);
			startLoc = GUI.Util.getPageLocation($ev);
			draggable = $src.data('pb-draggable') || testDraggable;
			// double click detection
			var now = Date.now();
			if (draggable == previousDraggable
				&& ( ( now - startTime) < 300)
				&& draggable.doubleClick($ev) ) {
					previousDraggable = null;
					return;
				}
			else
				previousDraggable = null;
			startTime = now;
			// create a clone
			$dragImage = draggable.start( $src, $ev, startLoc );
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
			$(document.body).on('touchmove.dnd mousemove.dnd', Dnd.dragMove);
			$(document.body).on('touchend.dnd mouseup.dnd', Dnd.dragEnd);
		},
		matchFlavors: function(srcFlavors, destFlavors) {
			for (var i=0; i<srcFlavors.length; i++) {
				if (destFlavors.indexOf( srcFlavors[i] ) != -1)
					return srcFlavors[i];
			}
			return null;
		},
		findDroppable: function($ev) {
			var NULL = { droppable: $(), flavor: null};
			if (draggable == null)
				return NULL;
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
			var loc = GUI.Util.getPageLocation($ev);
			var scrollTop = $(document).scrollTop();
			var scrollLeft = $(document).scrollLeft();
			var el = document.elementFromPoint( loc.x - scrollLeft,
													loc.y - scrollTop );
			while (el && el.nodeName != 'BODY' && el.nodeName != 'HTML') {
				var $el = $(el);
				if ($el.hasClass('pb-droppable')) {
					var droppable = $el.data('pb-droppable');
					if (droppable == null) {
				 		console.warn('.pb-droppable must have data(droppable)');
				 		droppable = testDroppable;
				 	}
				 	var flavor = this.matchFlavors(draggable.flavors, droppable.flavors);
				 	if ( flavor ) {
				 		restoreHidden();
				 		if (el.parentNode == null)
				 			debugger;
				 		return {droppable: $el, flavor: flavor};
				 	}
				}
				hide(el);
				el = document.elementFromPoint( loc.x - scrollLeft,
												loc.y - scrollTop );
			}
			restoreHidden();
			return NULL;
		},
		dragMove: function($ev) {
			// console.log('dragMove enter', $ev.type);
			$ev.preventDefault(); // stop touch scrolling
			$ev.stopPropagation();
			Dnd.clearWindowSelection();
			var loc = GUI.Util.getPageLocation($ev);
			loc.x = Math.max( Math.min( loc.x, dragBounds.right ), dragBounds.left);
			loc.y = Math.max( Math.min( loc.y, dragBounds.bottom), dragBounds.top);
			$dragImage.css( {
				top: loc.y,
				left: loc.x
			});
			var d = Dnd.findDroppable($ev);
			transferFlavor = d.flavor;
			Dnd.setDest( d.droppable );
			if (droppable) {
				window.setTimeout( function() {
					if (droppable)
						droppable.move($ev, transferFlavor);	// for smoother ui on touch
				},0);
			}
			// console.log("dragMove leave");
		},
		// return true if transfer successful
		doTransfer: function(ev) {
			try {
				var data = draggable.getTransferData($src, transferFlavor);
				droppable.putTransferData(ev, transferFlavor, data);
				droppable.leave();
				$dest = $();
				droppable = null;
				return true;
			}
			catch(ex) {
				console.warn('drag data transfer aborted', transferFlavor);
				return false;
			}
		},
		dragEnd: function($ev) {
			// console.log('dragEnd', $ev.type);
			webkitIpadBugWorkaround.endFix();
			previousDraggable = draggable;
			var transferDone = false;
			if ($dest.length > 0)
				transferDone = Dnd.doTransfer($ev);
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
			draggable.end( transferDone, $ev );
			Dnd.reset();
		}
	}

// Native Dnd
// implemented by delegating native dnd events to our Dnd api
// JS dnd events are messy: dragenter/dragleave can overlap in funny ways
	var NativeDraggable = new Draggable( {
		flavors: ['osFile'], // transferData: event.dataTransfer.files
		getTransferData: function($src, flavor) {
			var dataTransfer = $src.originalEvent.dataTransfer;
			if (dataTransfer.files && dataTransfer.files.length > 0) {
				console.log('got files');
				return dataTransfer.files;
			}
			else if (dataTransfer.types) {
				console.log('got file type');
				if ('contains' in dataTransfer.types)	// Firefox
					return dataTransfer.types.contains("Files");
				else // Chrome
					return dataTransfer.types.indexOf("Files") != -1;
			}
			console.log('got nothing');
			return null;
		}
	});

	var NativeDnd = {
		dragenter: function($ev) {
			console.log('dragenter');
			var dragFiles = NativeDraggable.getTransferData( $ev, 'osFile');
			if (dragFiles) {
				draggable = NativeDraggable;
				$ev.stopPropagation();
				$ev.preventDefault();
			}
		},
		dragover: function($ev) {
			console.log('dragover');
			if (!draggable)
				return;
			var d = Dnd.findDroppable($ev);
			transferFlavor = d.flavor;
			$src = $ev;	// hacky, in native dnd, $src is event instead of dom
			Dnd.setDest( d.droppable );
			if (droppable)
				droppable.move($ev, transferFlavor);
			$ev.stopPropagation();
			$ev.preventDefault();
		},
		dragleave: function($ev) {
			console.log('dragleave');
			$ev.stopPropagation();
			$ev.preventDefault();
			if (draggable)
				Dnd.setDest( $());
		},
		drop: function($ev) {
			console.log('drop');
			var dragFiles = NativeDraggable.getTransferData( $ev, 'osFile');
			if (dragFiles) {
				if (droppable) { // let droppable handle it
					try {
						var transferDone = droppable.putTransferData($ev, transferFlavor, dragFiles);
						droppable.leave();
						$dest = $();
						droppable = null;
					}
					catch(ex) {
					}
				}
				else { // add to book
					var book = PB.Book.default;
					GUI.Dnd.Util.filterFileList( dragFiles )
						.forEach( function( f ) {
							book.addLocalPhoto( f, { animate: true } );
						});
				}
			}
			$ev.preventDefault();
			$ev.stopPropagation();
		}
	}
	$(document).on('touchstart.dnd mousedown.dnd', ".pb-draggable", Dnd.dragStart );
	$('body')
		.on({
		dragenter: function(ev) { return NativeDnd.dragenter( ev ) },
		dragover: function(ev) { return NativeDnd.dragover( ev ) },
		dragleave: function(ev) { return NativeDnd.dragleave( ev ) },
		drop: function(ev) { return NativeDnd.drop( ev ) }
	});

	scope.Dnd = {
		Dnd: Dnd,
		Draggable: Draggable,
		Droppable: Droppable,
		Util: Util
	};
})(GUI);
