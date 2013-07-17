/* editor.gui.buttons.js
*/
(function(scope) {

	var TrashDroppable = new GUI.Dnd.Droppable( {
		flavors: [
			'page',	// transferData: transferData: pageModelId
			'photo', // transferData: serverPhotoId
			'photoInRoughPage', // transferData: assetId
			'photoInPage'	// transferData: { page: p, assetId: id }
		],
		enter: function( $dom, flavor, transferData) {
			this.dom = $dom;
			this.dom.addClass('drop-target');
		},
		leave: function( transferDone ) {
			this.dom.removeClass('drop-target');
		},
		putTransferData: function($ev, flavor, transferData) {
			switch(flavor) {
			case 'page':
				PB.ModelMap.model(transferData).remove({animate:true});
			break;
			case 'photo':
				var book = PB.Book.default;
				var bookPhoto = book.photo( book.bookPhotoId( transferData ));
				book.removePhoto( bookPhoto, { animate: true } );
			break;
			case 'photoInRoughPage':
				var pageAsset = PB.ModelMap.model( transferData);
				pageAsset.page.removeAsset( pageAsset.assetId, { animate: true });
			break;
			case 'photoInPage':
				transferData.page.clearPhoto( transferData.assetId );
			break;
			}
		}
	});

	var AddPageDraggableOptions = {
		flavors: [
			'newPage' // transferData: null
		],
		getTransferData: function($src, flavor) {
			return null;
		},
		isTouch: false,
		start: function( $el, $ev, startLoc ) {
//			console.log('start', $ev.type );
			this.isTouch = this.isTouch || ($ev.type == 'touchstart');
			this.startTime = Date.now();
			var bounds = $el[0].getBoundingClientRect();
			var $dom = GUI.Util.cloneDomWithCanvas($el)
				.addClass('touch-drag-src')
				.css( {
					top: startLoc.y,
					left: startLoc.x,
					marginLeft: bounds.left + $(document).scrollLeft() - startLoc.x,
					marginTop: bounds.top + $(document).scrollTop() - startLoc.y + 10,
					position: 'absolute'
				});
			var anchorStyling = window.getComputedStyle($el.find('a')[0]);
			$dom.find('a').css({
				paddingTop: anchorStyling.paddingTop,
				paddingLeft: anchorStyling.paddingLeft,
				paddingBottom: anchorStyling.paddingBottom,
				paddingRight: anchorStyling.paddingRight,
				color: anchorStyling.color,
				textDecoration: anchorStyling.textDecoration,
				textShadow: anchorStyling.textShadow
			});
			//	$dom.children().css('verticalAlign', 'top'); // eliminate LI whitespace
			return $dom;
		},
		end: function(transferDone, $ev) {
			var diff = Date.now() - this.startTime;
			if (diff > 300)
				this.isTouch = false;

			if ( this.isTouch && $ev.type == 'mouseup') // prevents double action when mouse & touch fire together
				return;
			console.log('end');
			var diff = Date.now() - this.startTime;
			if (!transferDone && diff < 300)
				PB.Book.default.addPage( -1, { animate: true });
		},
	}
	var Buttons = {
		init: function() {
			// Trash
			$('#trash-btn').addClass('pb-droppable')
				.data( 'pb-droppable', TrashDroppable );
			// Add page
			$('#add-page-btn').addClass('pb-draggable')
				.data( 'pb-draggable', new GUI.Dnd.Draggable( AddPageDraggableOptions));
			GUI.Dnd.Util.preventDefaultDrag($('#add-page-btn'));
			// Add photo
			$('#add-photo-btn')
				.on('mousedown touchstart', function() {
					$('#add-photo-input').click();
				})
				.children('a').on('click', function(ev) {
					// $('#add-photo-input').click();
					ev.preventDefault();
				});
			$("#add-photo-input").on( {
				change: function(e) {
					for (var i=0; i<this.files.length; i++)
						PB.Book.default.addLocalPhoto(this.files[i], {animate:true});
			}});
			ResizePaletteButton.init();
		}
	}

	var lastMouse = 0;
	var yOffset = 0;	// Number to add to clientY to find center of the button
	var touchId = 0;
	var paletteRect = {};
	var ResizePaletteButton = {
		init: function() {
			paletteRect = document.getElementById('palette-resize-btn').getBoundingClientRect();
			if (PB.hasTouch()) {
				$('#palette-resize-btn').on({
					touchstart: function(ev) {
						ev = ev.originalEvent;
						touchId = ev.touches[0].identifier;
						ResizePaletteButton.startDrag(ev.touches[0].clientY);
					},
					touchmove: function(ev) {
						ev = ev.originalEvent;
						var newTouch = ResizePaletteButton.touchItemById(ev.changedTouches, touchId);
						if (!newTouch)

							return;
						else {
							ResizePaletteButton.continueDrag(newTouch.clientY);

							ev.preventDefault();
						}
					},
					touchend: function(ev) {
						touchId = 0;
						ResizePaletteButton.endDrag();
					},
					touchcancel: function(ev) {
						touchId = 0;
						ResizePaletteButton.endDrag();
					}
				});
			}
			else {
				$('#palette-resize-btn').on({
					mousedown: function(ev) {
						ResizePaletteButton.startDrag(ev.originalEvent.clientY);
						ev.stopPropagation();
						ev.preventDefault();
						$('body').mousemove(function(ev) {
							ev.stopPropagation();
							ev.preventDefault();
							ResizePaletteButton.continueDrag(ev.originalEvent.clientY)
						});
						$('body').mouseup(function(ev) {
							$('body').off('mousemove');
							$('body').off('mouseup');
							ev.stopPropagation();
							ev.preventDefault();
							ResizePaletteButton.endDrag(ev.originalEvent.clientY);
						});
					},
					click: function(ev) {
						ev.stopPropagation();
						ev.preventDefault();
					}
				});
			}
		},
		touchItemById: function(touchList, identifier) {
			for (var i=0; i<touchList.length; i++) {
				if (touchList[i].identifier == identifier)
					return touchList[i];
			}
			return null;
		},
		startDrag: function(clientY) {
			lastMouse = clientY;
			paletteRect = document.getElementById('palette-resize-btn').getBoundingClientRect();
			yOffset = paletteRect.top + paletteRect.height / 2 - clientY;
//			console.log('yOffset', yOffset);
		},
		continueDrag: function(clientY) {
			var heights = GUI.Palette.getPossibleHeights();
			var min = heights[0];
			var max = heights[heights.length -1];
			var mainRect = document.getElementById('main-content').getBoundingClientRect();
			var loc = GUI.Util.clamp(clientY,
				mainRect.top + min - yOffset,
				mainRect.top + max - yOffset);
//			console.log('clientY', clientY, 'mainRect.top', mainRect.top, 'loc', loc, 'yOffset', yOffset);
			var buttonTop = loc + yOffset - mainRect.top - paletteRect.height / 2;
//			console.log('buttonTop', buttonTop);
			$('#palette-resize-btn').css({top: buttonTop});
			GUI.Palette.setHeight(loc + yOffset - mainRect.top, false);
		},
		endDrag: function(clientY) {
		},
		fixPosition: function() {
			var paletteHeight = $('#palette:visible').length == 1 ? $('#palette').outerHeight() : 0;
			var pos = paletteHeight - paletteRect.height / 2;
			if (pos < paletteRect.height)
				$('#palette-resize-btn').hide();
			else
				$('#palette-resize-btn')
					.show()
					.css('top', $('#palette').outerHeight() - paletteRect.height / 2);
		}
	}

	var FireButton = function ($dom, options) {
		this.dom = $dom;
		this.fireCount = 0;	// how many times have we fired?
		this.active = false;
		this.options = $.extend( {
			start: null,
			stop: null,
			fire: null
		}, options);
		this.initEventHandlers();
	}

	FireButton.prototype = {
		initEventHandlers: function() {
			this.dom.data('fire-handler', this)
				.on('touchstart.fire mousedown.fire', function($ev) {
					$($ev.currentTarget).data('fire-handler').start($ev);
				});
		},
		start: function($ev) {
			var THIS = this;
			this.active = true;
			this.fireCount = 0;
			$(document.body).on('touchend.fire mouseup.fire', function($ev) {
				THIS.stop($ev);
			});
			if (this.options.start)
				this.options.start($ev, this.dom);
			else
				console.log('fire button start');
			this.fire();
			$ev.stopPropagation();
			$ev.preventDefault();
		},
		stop: function($ev) {
			if (this.options.stop)
				this.options.stop($ev, this.dom);
			this.active = false;
			$ev.stopPropagation();
			$ev.preventDefault();
			$(document.body).off('touchend.fire mouseup.fire');
		},
		fire: function() {
			if (!this.active)
				return;
			var delay = 100;
			if (this.options.fire)
				delay = this.options.fire(this.fireCount++);
			else
				console.log('fire button fire');
			var THIS = this;
			var startTime = Date.now();
			window.setTimeout(function() {
				console.log("fired after", Date.now() - startTime);
				THIS.fire();
			}, delay);
		}
	}
	scope.Buttons = Buttons;
	scope.Buttons.ResizePaletteButton = ResizePaletteButton;
	scope.Buttons.FireButton = FireButton;

})(window.GUI);

