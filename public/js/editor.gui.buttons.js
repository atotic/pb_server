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
				click: function() {
					$('#add-photo-input').click();
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
			var addBtn = $('#add-page-btn');
			addBtn.click(
				function() { GUI.RoughWorkArea.book.insertRoughPage(-1, {animate: true} ); }
				);

			if (PB.hasTouch())
				scope.TouchDragHandler.makeDraggable(addBtn, 'addRoughPage');
			else
				addBtn.attr('draggable', true).on( {
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

			$('#remove-page-btn').attr('dropzone', true).on( {
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
	var yOffset = 0;
	var touchId = 0;
	var ResizePaletteButton = {
		init: function() {
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
						$('body').mousemove(function(ev) { ResizePaletteButton.continueDrag(ev.originalEvent.clientY)});
						$('body').mouseup(function(ev) {
							$('body').off('mousemove');
							$('body').off('mouseup');
							ResizePaletteButton.endDrag(ev.originalEvent.clientY);
						});
					}
				});
			}
		},
		startDrag: function(clientY) {
			lastMouse = clientY;
			var r = document.getElementById('palette-resize-btn').getBoundingClientRect();
			yOffset = r.top + r.height / 2 - clientY;
		},
		continueDrag: function(clientY) {
			var heightMinMax = GUI.Controller.getMinMaxPaletteHeight();
			var palRect = document.getElementById('palette-tabs-container').getBoundingClientRect();
			// where the midpoint
			var clientMinMax = { min: palRect.top + heightMinMax.min,
				max: palRect.top + heightMinMax.max };
			var loc = GUI.Util.clamp(clientY, clientMinMax.min - yOffset, clientMinMax.max - yOffset);
			var diff = loc - lastMouse;
			lastMouse = loc;
			GUI.Controller.setContainerHeight($('#palette-tabs-container').height() + diff, false);
		},
		endDrag: function(clientY) {
		}
	}

	scope.Buttons = Buttons;
})(window.GUI);

