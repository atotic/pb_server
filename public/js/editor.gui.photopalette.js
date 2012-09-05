// editor.gui.photopalette.js

// PhotoPalette
// images can be dragged out
(function(scope){
"use strict";
	var PhotoPalette = {
		bindToBook: function(book) {
			this.makeDroppable();
			// Keep models in sync
			$('#photo-list')
				.data('model', book)
				.on(PB.MODEL_CHANGED,
					function(ev, model, prop, options) {
						if (prop == 'photoList')
							PhotoPalette.synchronizePhotoList(options);
					});
			GUI.Options.addListener(this.optionsChanged);
			this.synchronizePhotoList();
		},
		optionsChanged: function(name, val) {
			switch(name) {
				case 'photoFilter':
					GUI.PhotoPalette.synchronizePhotoList();
					break;
				case 'photoSize':
					GUI.PhotoPalette.resizeAllImages();
					break;
				case 'photoSort':
					GUI.PhotoPalette.synchronizePhotoList();
					$('#photo-list .photo-div').each(function() {
						var el = $(this);
						GUI.PhotoPalette.setTileInfo(el, el.data('model'));
					});
					break;
				default:
					break;
			}
		},
		getDomBoxInfo: function() {
			var photoList = $('#photo-list');
			var domBoxInfo = {
				photoList: {
					top: parseInt(photoList.css('margin-top')),
					bottom: parseInt(photoList.css('margin-bottom'))
				},
				photoDiv: {	top: 2, bottom: 2} // guess
			}
			var photoDiv = $('#photo-list > .photo-div');
			if (photoDiv.length != 0)
				domBoxInfo.photoDiv = {
					top: parseInt(photoDiv.css('margin-top')),
					bottom: parseInt(photoDiv.css('margin-bottom')),
					height: GUI.Options.photoSizeHeight
				}
			return domBoxInfo;
		},
		// Have to return margins too
		getPossibleHeights: function(max) {
			$('#photo-list-container').stop();
			var boxInfo = this.getDomBoxInfo();
			var retVal = {
				top: boxInfo.photoList.top,
				bottom: boxInfo.photoList.bottom,
				heights: [boxInfo.photoDiv.height + boxInfo.photoDiv.top + boxInfo.photoDiv.top * 3]
			};
			var i = 0;
			var photoHeight = boxInfo.photoDiv.height + boxInfo.photoDiv.top;
			while ((retVal.heights[i] + photoHeight) < max)
				retVal.heights.push(retVal.heights[i++] + photoHeight);
			return retVal;
		},
		startDragEffect: function(tile) {
			$(tile).css('opacity', '0');
		},
		stopDragEffect: function(tile) {
			if (!$(tile).data('pb.markedForDelete'))
				$(tile).css('opacity', '1.0');
		},
		hasDragFlavors: function() {
			return GUI.DragStore.hasFlavor(
				GUI.DragStore.OS_FILE,
				GUI.DragStore.ROUGH_IMAGE);
		},
		makeDroppable: function() {
			$('#photo-list').attr('dropzone', true).on({
				dragenter: function(ev) {
					GUI.DragStore.setDataTransferFlavor(ev.originalEvent.dataTransfer);
					if (!PhotoPalette.hasDragFlavors())
						return;
//					console.log('dragenter palette');
					ev.preventDefault();
				},
				dragover: function(ev) {
					if (!PhotoPalette.hasDragFlavors())
						return;
//					console.log('dragover palette');
					$(this).addClass('drop-target');
				},
				dragleave: function(ev) {
					if (!PhotoPalette.hasDragFlavors())
						return;
//					console.log('dragleave palette');
					$(this).removeClass('drop-target');
				},
				drop: function(ev) {
					$(this).removeClass('drop-target');
					if (!PhotoPalette.hasDragFlavors())
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
							GUI.DragStore.hadDrop = true;
						break;
					}
				}
			});
		},
		addPhoto: function(photo) {
			var img = this.createImageTile(photo);
			$('#photo-list').append(img);
		},
		setTileStatus: function(tile, model) {
			var statusDiv = tile.children('.status');
			var msg = model.status;
			if (msg) {
				if (statusDiv.length == 0) {
					statusDiv = $("<div class='status'>");
					tile.append(statusDiv);
				}
				statusDiv.text(msg);
			}
			else
				statusDiv.detach();
		},
		setTileInfo: function(tile, model) {
			var infoDiv = tile.children('.info');
			var infoTxt;
			switch(GUI.Options.photoSort) {
				case 'taken':
					var d = model.jsDate;
					if (d)
						infoTxt = d.getFullYear() + "/" + (d.getMonth() + 1) + "/" + d.getDate();
					break;
				case 'added':
					break;
				case 'name':
					infoTxt = model.display_name;
					break;
			}
			if (infoTxt) {
				if (infoDiv.length == 0) {
					infoDiv = $("<div class='info'>");
					tile.append(infoDiv);
				}
				infoDiv.text(infoTxt);
			}
			else
				infoDiv.detach();
		},
		setTileProgress: function(tile, model) {
			var progressDiv = tile.children('.progress');
			var percent = model.progress;
			if (percent) {
				if (progressDiv.length == 0) {
					progressDiv = $("<div class='progress'><div class='bar' style='width:0%;'></div></div>");
					tile.append(progressDiv);
				}
				if (percent == -1)
					progressDiv.addClass('progress-striped')
						.addClass('active')
						.children('.bar').css('width', '100%');
				else
					progressDiv.removeClass('progress-striped')
						.removeClass('active')
						.children('.bar').css('width', percent + '%');
			}
			else
				progressDiv.detach();
		},
		resizeAllImages: function() {
			$('.photo-div > img').each(function() {
				var el = $(this);
				el.stop();
				var newSize = PhotoPalette.scaleTileDimensions({ width: this.naturalWidth, height: this.naturalHeight });
				el.width(newSize.width).height(newSize.height);
			});
		},

		scaleTileDimensions: function(dims) {
			var scaleH = GUI.Options.photoSizeWidth / dims.width;
			var scaleV = GUI.Options.photoSizeHeight / dims.height;
			var scale = Math.min(scaleH, scaleV);
			return {width: dims.width * scale, height: dims.height * scale};
		},
		createImageTile: function(photo) {
			var imgData = photo.getUrl(128);
			var tile = $("<div class='photo-div'><img src='" + imgData.url + "'></div>");
			var img = $(tile).children('img');
			var scaled = this.scaleTileDimensions(imgData);
			img.width(scaled.width).height(scaled.height);
			tile.data('model', photo)
				.on(PB.MODEL_CHANGED,
					function(ev, model, prop, options) {
						var img = $(tile).children('img');
						switch(prop) {
							case 'icon_url':
								tile.stop(true, true);
								var imgData = photo.getUrl(128);
								var scaled = THIS.scaleTileDimensions(imgData);
								img.prop('src', imgData.url).width(scaled.width).height(scaled.height);
							break;
							case 'status':
								PhotoPalette.setTileStatus(tile, model);
								break;
							case 'progress':
								PhotoPalette.setTileProgress(tile, model);
							break;
							default:
							break;
						}
				});
			var THIS = this;
			this.setTileStatus(tile, photo);
			this.setTileProgress(tile, photo);
			this.setTileInfo(tile, photo);
			window.setTimeout(function() {
				// iPad bug workaround. Without timer, touch handlers are not registered
				THIS.makeDraggable(tile);
			}, 0);
			return tile;
		},
		sortPhotos: function(book, photos) {
			function dateComparator(a,b) {
				var a_date = a.photo.jsDate;
				var b_date = b.photo.jsDate;
				if (a_date && b_date)
					return a_date - b_date;
				else {
					if (a_date == null) {
						if (b_date == null)
							return b.loc - a.loc;
						else
							return -1;
					}
					else
						return 1;
				}
			};
			function addedComparator(a,b) {
				return a.loc - b.loc;
			};
			function nameComparator(a,b) {
				var a_name = a.photo.display_name;
				var b_name = b.photo.display_name;
				// natural sort, if possible
				var a_match = a_name.match(/(\d+)/);
				var b_match = b_name.match(/(\d+)/);
				var a_num = a_match ? parseInt(a_match[1], 10) : NaN;
				var b_num = b_match ? parseInt(b_match[1], 10) : NaN;
				if (a_num != a_num || b_num != b_num) { // weird way of testing isNan(a_num) || isNan(b_num)
					if (a_name < b_name)
						return -1;
					else if (b_name < a_name)
						return 1;
					else
						return a.loc - b.loc;
				}
				else {
					if (a_num == b_num)
						return a.loc - b.loc;
					else
						return a_num - b_num;
				}
			};
			if (photos.length == 0)
				return photos;
			var modelArray = [];
			for (var i=0; i<photos.length; i++)
				modelArray.push({photo: PB.ServerPhotoCache.get( photos[i]), loc: i});
			var compareFn;
			switch (GUI.Options.photoSort) {
				case 'added': compareFn = addedComparator; break;
				case 'taken': compareFn = dateComparator; break;
				case 'name': compareFn = nameComparator; break;
				default: console.error("unknown compare fn for sortPhotos");
			}
			modelArray.sort(compareFn);
			return modelArray.map(function(a) { return a.photo.id});
		},
		synchronizePhotoList: function(options) {
			options = $.extend({animate:false}, options);
			var containerDom = $('#photo-list');
			var bookModel = containerDom.data('model');
			var sel = '.photo-div';

			var oldChildren = containerDom.children( sel ).get();
			var oldPhotos = oldChildren.map(
				function(el, i) { return $(el).data('model').id});

			var newPhotos = GUI.Options.photoFilter == 'all' ? bookModel.photoList : bookModel.unusedPhotoList;
			newPhotos = this.sortPhotos(bookModel, newPhotos);
			var diff = JsonDiff.diff(oldPhotos, newPhotos);
			console.log("synchronizePhotoList", diff.length);
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
										$(this).css('width', 'auto');	// because our default width might be wrong

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
					var dest = containerDom.children(sel).get(destIndex);
					GUI.Util.swapDom(src, dest, options.animate);
				break;
				}
			}
			console.log("synchronizePhotoList done");
		}
	}

	var PhotoPaletteDnd = {
		makeDraggable: function(imgdiv) {
			$(imgdiv).attr('draggable', true).on( {
				'dragstart': function(ev) {
					ev = ev.originalEvent;
					ev.dataTransfer.clearData();
					var img = $(this).children('img').get(0);
					console.log("img", img.src);
					try {
						ev.dataTransfer.setData('text/uri-list', img.src);
					}
					catch(ex) { // IE
						console.warn("IE setData");
						ev.dataTransfer.setData("URL", img.src);
					}
					var canvas = GUI.Util.imgToCanvas(img);
					var r = this.getBoundingClientRect();
					try {
						ev.dataTransfer.setDragImage(canvas,ev.clientX - r.left, ev.clientY - r.top);
					}
					catch(ex) {
						console.warn("IE setDragImage");
					}
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
		makeDraggable: function(tile) {
			scope.TouchDragHandler.makeDraggable(tile, 'image',
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

(function(scope) {
	var Palette = {
		getPossibleHeights: function() {
			var max = Math.min($('body').height() - 200);
			var heights = GUI.PhotoPalette.getPossibleHeights(max);
			var palette = $('#palette');
			var topExtra = heights.top + parseInt(palette.css('padding-top'));
			var bottomExtra = heights.bottom + parseInt(palette.css('padding-bottom'));
			return heights.heights.map(function(x) { return x + topExtra + bottomExtra;});
		},
		setHeight: function(height, animate) {
			var palette = $('#palette');
			var padding = parseInt(palette.css('padding-top')) + parseInt(palette.css('padding-bottom'));
			var containerHeight = height - padding;
			$('#photo-list-container').css({minHeight: containerHeight, maxHeight: containerHeight});
			GUI.fixSizes();
		}
	};
	scope.Palette = Palette;
})(window.GUI);
