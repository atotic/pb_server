/* editor.gui.buttons.js
*/
(function(scope) {

	var Buttons = {
		init: function() {
			AddRemoveButtons.init();
			ResizePaletteButton.init();
			AddPhotoButton.init();
		}
	}

	var AddPhotoButton = {
		init: function() {
			$('#add-photo-btn').on( {
				click: function(ev) {
					$('#add-photo-input').click();
					ev.preventDefault();
					ev.stopPropagation();
				}
			});
			$("#add-photo-input").on( {
				change: function(e) {
					for (var i=0; i<this.files.length; i++)
						PB.Book.default.addLocalPhoto(this.files[i], {animate:true});
				}});
		}
	}
	var AddRemoveButtons = {
		init: function() {
			var addPageBtn = $('#add-page-btn');
			addPageBtn.click(
				function() { GUI.RoughWorkArea.book.insertRoughPage(-1, {animate: true} ); }
				);

			if (PB.hasTouch())
				scope.TouchDragHandler.makeDraggable(addPageBtn, 'addRoughPage');
			else
				addPageBtn.attr('draggable', true).on( {
					dragstart: function(ev) {
						ev = ev.originalEvent;
						ev.dataTransfer.clearData();
						ev.dataTransfer.setData('text/plain', "my text");
						GUI.DragStore.reset(GUI.DragStore.ADD_PAGE_BUTTON);
						ev.dataTransfer.effectAllowed = "move";
					},
					dragend: function(ev) {
						GUI.DragStore.reset();
					}
				});

			$('#trash-btn').attr('dropzone', true).on( {
				dragover: function(ev) {
					ev = ev.originalEvent;
					ev.preventDefault();
					if (!(GUI.DragStore.hasFlavor(GUI.DragStore.ROUGH_PAGE,
							GUI.DragStore.IMAGE, GUI.DragStore.ROUGH_IMAGE)))
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
					switch(GUI.DragStore.flavor) {
					case 'roughPage':
						$(GUI.DragStore.dom).data('model').remove({animate:true});
						break;
					case 'image':
						GUI.RoughWorkArea.book.removePhoto(
							$(GUI.DragStore.dom).data('model'), {animate: true});
						break;
					case 'roughImage':
						var ri = $(GUI.DragStore.dom);
						var photo = ri.data('model');
						var roughPage = ri.parent().data('model');
						roughPage.removePhoto(photo, {animate: true});
						break;
					}
					GUI.DragStore.hadDrop = true;
				}
			});
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
						var newTouch = GUI.TouchDragHandler.touchItemById(ev.changedTouches, touchId);
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
			$('#palette-resize-btn').css('top', $('#palette').outerHeight() - paletteRect.height / 2);
		}
	}

	scope.Buttons = Buttons;
	scope.Buttons.ResizePaletteButton = ResizePaletteButton;
})(window.GUI);

