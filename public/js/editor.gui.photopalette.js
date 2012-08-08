// editor.gui.photopalette.js

// PhotoPalette
// images can be dragged out
(function(scope){
	var PhotoPalette = {
		bindToBook: function(book) {
			this._photoFilter = 'unused'; // 'all'
			this.makeDroppable();
			// Keep models in sync
			$('#photo-list')
				.data('model', book)
				.on(PB.MODEL_CHANGED,
					function(ev, model, prop, options) {
						if (prop == 'photoList')
							PhotoPalette.synchronizePhotoList(options);
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
		startDragEffect: function(img) {
			$(img).css('opacity', '0');
		},
		stopDragEffect: function(img) {
			if (!$(img).data('pb.markedForDelete'))
				$(img).css('opacity', '1.0');
		},
		hasDragSources: function() {
			return GUI.DragStore.hasFlavor(
				GUI.DragStore.OS_FILE,
				GUI.DragStore.ROUGH_IMAGE);
		},
		makeDroppable: function() {
			$('#photo-list').attr('dropzone', true).on({
				dragenter: function(ev) {
					GUI.DragStore.setDataTransferFlavor(ev.originalEvent.dataTransfer);
					if (!PhotoPalette.hasDragSources())
						return;
					console.log('dragenter palette');
					ev.preventDefault();
				},
				dragover: function(ev) {
					if (!PhotoPalette.hasDragSources())
						return;
					console.log('dragover palette');
					$(this).addClass('drop-target');
				},
				dragleave: function(ev) {
					if (!PhotoPalette.hasDragSources())
						return;
					console.log('dragleave palette');
					$(this).removeClass('drop-target');
				},
				drop: function(ev) {
					$(this).removeClass('drop-target');
					if (!PhotoPalette.hasDragSources())
						return;
					ev = ev.originalEvent;
					switch(GUI.DragStore.flavor) {
						case 'os_file': // PB.DragStore.OS_FILE:
						return; // Document will handle the drop
						case 'roughImage':
							var ri = $(GUI.DragStore.dom);
							var photo = ri.data('model');
							var roughPage = ri.parent().data('model');
							roughPage.removePhoto(photo, {animate: true});
							ev.stopPropagation();
							ev.preventDefault();
						break;
					}
				}
			});
		},
		addPhoto: function(photo) {
			var img = this.createImageTile(photo);
			$('#photo-list').append(img);
		},
		createImageTile: function(photo) {
			var img = $("<img src='" + photo.getUrl(128) + "'>");
			img
				.data('model', photo)
				.on(PB.MODEL_CHANGED,
					function(ev, model, prop, options) {
						switch(prop) {
							case 'icon_url':
								img.prop('src', photo.getUrl(128));
							break;
							default:
							break;
						}
				});
			var THIS = this;
			window.setTimeout(function() {
				// iPad bug workaround. Without timer, touch handlers are not registered
				THIS.makeDraggable(img);
			}, 0);
			return img;
		},
		synchronizePhotoList: function(options) {
			options = $.extend({animate:false}, options);
			var containerDom = $('#photo-list');
			var bookModel = containerDom.data('model');
			var sel = 'img';

			var oldChildren = containerDom.children( sel ).get();
			var oldPhotos = oldChildren.map(
				function(el, i) { return $(el).data('model').id});
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
					if (options.animate) {
						GUI.Util.revealByScrolling(newDom, $('#photo-list-container'));
						var w = newDom.width();
						newDom.css('width', 0)
									.animate({width: w}, {complete: function() {
										newDom.css('width', 'auto');	// because our default width might be wrong
						}});
					}
				break;
				case 'delete':
					var el = $(containerDom.children(sel).get(targetIndex));
					if (options.animate) {
						el.css('visible', 'hidden')
							.data('pb.markedForDelete', true)
							.animate({width: 0}, function() {
							 	el.detach();
							});
					}
					else
						el.detach();
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
					ev.dataTransfer.clearData();
					ev.dataTransfer.setData('text/uri-list', this.src);
					var r = this.getBoundingClientRect();
					var canvas = GUI.Util.imgToCanvas(this);
					ev.dataTransfer.setDragImage(canvas,ev.clientX - r.left, ev.clientY - r.top);
					PhotoPalette.startDragEffect(this);
					GUI.DragStore.reset(GUI.DragStore.IMAGE, {dom: this});
					ev.effectAllowed = 'move';
				},
				'dragend': function(ev) {
					PhotoPalette.stopDragEffect(this);
					GUI.DragStore.reset();
				}
			});
		}
	}
	var PhotoPaletteTouch = {
		makeDraggable: function(img) {
			scope.TouchDragHandler.makeDraggable(img, 'image',
				function() { PhotoPalette.startDragEffect(GUI.DragStore.dom);},
				function() { PhotoPalette.stopDragEffect(GUI.DragStore.dom)}
				);
		}
	}

	if (PB.hasTouch()) {
		$.extend(PhotoPalette, PhotoPaletteTouch);
	}
	else
		$.extend(PhotoPalette, PhotoPaletteDnd);

	scope.PhotoPalette = PhotoPalette;
})(window.GUI);
