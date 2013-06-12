// editor.gui.page.editable.js

(function(scope) {
	var PageDroppable = new GUI.Dnd.Droppable({
		flavors: ['background', 'layout', 'widget', 'design'],
		enter: function($dom, flavor, transferData) {
			this.page = PB.Page.Selection.findClosest($dom).bookPage;
			this.dom = $dom;
			this.dropFlavor = flavor;
			switch( this.dropFlavor ) {
				case 'background':
					this.page.startTemporaryChanges();
					this.oldBackground = this.page.p.backgroundId;
					this.oldBackgroundData = this.page.p.backgroundData;
					this.page.setBackground(transferData);
				break;
				case 'layout':
					this.page.startTemporaryChanges();
					this.oldLayout = this.page.p.layoutId;
					this.oldLayoutData = this.page.p.layoutData;
					this.page.setLayout( transferData);
				break;
				case 'widget':
					this.page.startTemporaryChanges();
					this.dom.addClass('drop-target');
				break;
				case 'design':
					this.page.startTemporaryChanges(true);
					this.oldDesignId = this.page.p.designId;
					this.page.setDesign( transferData );
				break;
				default:
					console.error('unknown drop flavor', this.dropFlavor );
				break;
			};
		},
		leave: function() {
			switch( this.dropFlavor ) {
				case 'background':
				 	if ('oldBackground' in this) {
						this.page.setBackground( this.oldBackground, this.oldBackgroundData );
						this.page.endTemporaryChanges();
				 	}
				break;
				case 'layout':
					if ('oldLayout' in this) {
 						this.page.setLayout(this.oldLayout, this.oldLayoutData);
						this.page.endTemporaryChanges();
					}
				break;
				case 'widget':
					this.dom.removeClass('drop-target');
					this.page.endTemporaryChanges();
				break;
				case 'design':
					if ('oldDesignId' in this) {
						this.page.endTemporaryChanges(true);
					}
				break;
			}
		},
		putTransferData: function( $ev, flavor, transferData ) {
			switch( this.dropFlavor ) {
				case 'background':
					this.page.endTemporaryChanges();
					this.page.setBackground( transferData );
					delete this.oldBackground;
				break;
				case 'layout':
					this.page.endTemporaryChanges();
					this.page.setLayout( transferData );
					delete this.oldLayout;
				break;
				case 'widget':
					this.page.endTemporaryChanges();
					var loc = GUI.Util.getPageLocation($ev);
					var pageBounds = this.dom[0].getBoundingClientRect();
					var widget = PB.ThemeCache.resource(transferData);
					this.page.addAsset( {
						type: 'widget',
						widgetId: transferData,
						top: loc.y - widget.height() / 2 - (pageBounds.top + window.scrollY),
						left: loc.x - widget.width() / 2 - (pageBounds.left + window.scrollX),
						width: widget.width(),
						height: widget.height()
					});
				break;
				case 'design':
					this.page.endTemporaryChanges(false);
					delete this.oldDesignId;
				break;
			}
		}
	});

	var PhotoDroppable = new GUI.Dnd.Droppable( {
		flavors: ['frame', 'photo', 'photoInPage'],
		setTempPhoto: function(asset, photoId) {
			this.oldPhotoId = asset.photoId;
			this.oldZoom = asset.zoom;
			this.oldPhotoRect = asset.photoRect;
			this.oldFocalPoint = asset.focalPoint;
			this.page.updateAsset(this.assetId, {
				photoId: photoId,
				zoom: 1.0,
				focalPoint: null
			});
			if (this.sourceAssetId) {
				this.sourcePage.startTemporaryChanges();
				var oldAsset = this.sourcePage.getAsset( this.sourceAssetId );
				this.oldSourcePhotoId = oldAsset.photoId;
				this.oldSourceZoom = oldAsset.zoom;
				this.oldSourcePhotoRect = oldAsset.photoRect;
				this.oldSourceFocalPoint = oldAsset.focalPoint;
				this.sourcePage.updateAsset(this.sourceAssetId, {
					photoId: this.oldPhotoId,
					zoom: 1.0,
					focalPoint: null
				});
			}
		},
		restoreTempPhoto: function() {
			if ('oldPhotoId' in this) {
				this.page.updateAsset( this.assetId, {
					photoId: this.oldPhotoId,
					zoom: this.oldZoom,
					photoRect: this.oldPhotoRect,
					focalPoint: this.oldFocalPoint
				});
				if ( this.sourceAssetId) {
					this.sourcePage.endTemporaryChanges();
					this.sourcePage.updateAsset( this.sourceAssetId, {
						photoId: this.oldSourcePhotoId,
						zoom: this.oldSourceZoom,
						photoRect: this.oldSourcePhotoRect,
						focalPoint: this.oldSourceFocalPoint
					});
					delete this.sourceAssetId;
				}
			}
		},
		enter: function($dom, flavor, transferData, handoff) {
			this.page = PB.Page.Selection.findClosest($dom).bookPage;
			this.assetId = $dom.data('model_id');
			this.dom = $dom;
			this.dropFlavor = flavor;
			var asset = this.page.getAsset( this.assetId );
			switch( this.dropFlavor ) {
				case 'frame':
					this.page.startTemporaryChanges();
					if (handoff)
						$.extend(this, handoff);
					else {
						this.oldFrameId = asset.frameId;
						this.oldFrameData = asset.frameData;
						this.page.updateAsset( this.assetId, {
							frameId: transferData
						});
					}
				break;
				case 'photo': {
					this.page.startTemporaryChanges();
					if (handoff)
						$.extend(this, handoff);
					else {
						this.setTempPhoto(asset, transferData);
					}
				}
				break;
				case 'photoInPage':
					if (transferData.assetId == this.assetId)
						throw new Error("No dropping image on itself");
					this.page.startTemporaryChanges();
					if (handoff)
						$.extend(this, handoff);
					else {
						this.sourcePage = transferData.page;
						this.sourceAssetId = transferData.assetId;
						this.setTempPhoto(asset,
							transferData.page.getAsset( transferData.assetId).photoId);
					}
				break;
			}
		},
		getHandoff: function() {
			switch(this.dropFlavor) {
				case 'frame':
					return {
						oldFrameId: this.oldFrameId,
						oldFrameData: this.oldFrameData
					}
				case 'photo':
				case 'photoInPage':
					return {
						oldPhotoId: this.oldPhotoId,
						oldZoom: this.oldZoom,
						oldPhotoRect: this.oldPhotoRect,
						oldFocalPoint: this.oldFocalPoint
					}
			}
		},
		leave: function(handoffAssetId) {
			if (handoffAssetId == this.assetId) {
				this.page.endTemporaryChanges();
				return this.getHandoff();
			}

			switch( this.dropFlavor ) {
				case 'frame':
				 	if ('oldFrameId' in this) {
						this.page.updateAsset( this.assetId, {
							frameId: this.oldFrameId,
							frameData: this.oldFrameData
						});
					}
				break;
				case 'photo':
				case 'photoInPage':
					this.restoreTempPhoto();
				break;

			}
			this.page.endTemporaryChanges();
		},
		putTransferData: function( $ev, flavor, transferData ) {
			switch( this.dropFlavor ) {
				case 'frame':
					this.page.updateAsset( this.assetId, {
						frameId: transferData
					});
					delete this.oldFrameId;
				break;
				case 'photo':
					delete this.oldPhotoId;
				break;
				case 'photoInPage':
					// photo already there, just prevent restore
					delete this.oldPhotoId;
					delete this.sourceAssetId;
				break;
			}
		}
	});

	var DesignDraggableOptions = {
		flavors: ['design'],
		designId: 'your id here',
		getTransferData: function(ev, $src, flavor) {
			return this.designId;
		}
	}

	var BackgroundDraggableOptions = {
		flavors: ['background'],
		backgroundId: 'your background id here',
		getTransferData: function(ev, $src, flavor) {
			return this.backgroundId;
		}
	}

	var LayoutDraggableOptions = {
		flavors: ['layout'],
		layoutId: 'your id here',
		getTransferData: function(ev, $src, flavor) {
			return this.layoutId;
		}
	}

	var PhotoDraggableOptions = {
		flavors: ['photo'],
		photoId: 'your id here',
		getTransferData: function(ev, $src, flavor) {
			return this.photoId;
		}
	}
	var WidgetDraggableOptions = {
		flavors: ['widget'],
		widgetId: 'your id here',
		start: function($el, ev, startLoc) {
			var widget = PB.ThemeCache.resource(this.widgetId);
			var maxDim = 300;
			var width = widget.width();
			var height = widget.height();
			var scale = Math.min( maxDim/width, maxDim/height);
			if (scale < 1) {
				width *= scale;
				height *= scale;
			}
			var $widgetDom = widget.generateDom( width, height, {}, {resolution: PB.PhotoProxy.MEDIUM });
			var $dom = $('<div>').append($widgetDom);
			$dom.addClass('touch-drag-src')
				.css( {
					top: startLoc.y,
					left: startLoc.x,
					marginLeft: -width / 2,
					marginTop: -height / 2,
					background: 'transparent'
				});
			GUI.Util.preventDefaultDrag($dom);
			return $dom;
		},
		getTransferData: function(ev, $src, flavor) {
			return this.widgetId;
		}
	}

	var FrameDraggableOptions = {
		flavors: ['frame'],
		frameId: 'your id here',
		getTransferData: function(ev, $src, flavor) {
			return this.frameId;
		}
	}

	var PhotoInPageDraggableOptions = {
		flavors: ['photoInPage'],
		getTransferData: function(ev, $src, flavor) {
			return {
				page: this.page,
				assetId: this.assetId
			};
		},
		start: function($dom, ev, startLoc) {
			this.page = PB.Page.Selection.findClosest($dom).bookPage;
			this.assetId = $dom.data('model_id');
			var asset = this.page.getAsset( this.assetId );
			var photo = PB.ServerPhotoCache.get( asset.photoId );
			var maxSize = 128;
			var d = photo.dimensions;
			var scale = Math.min(1, Math.min( maxSize / d.width, maxSize / d.height));
			d.width *= scale;
			d.height *= scale;
			var $drag = $('<img>')
				.css({
					position: 'absolute',
					top: startLoc.y,
					left: startLoc.x,
					width: d.width,
					height: d.height,
					marginTop: -d.height / 2,
					marginLeft: -d.width /2,
					border: '1px dashed white'
				})
				.prop('src', photo.getUrl(PB.PhotoProxy.SMALL));
			GUI.Util.preventDefaultDrag($drag);
			return $drag;
		}
	}


	scope.Page.Editor = {
		Droppable: {
			Page: PageDroppable,
			Photo: PhotoDroppable
		},
		DraggableOptions: {
			Design: DesignDraggableOptions,
			Background: BackgroundDraggableOptions,
			Layout: LayoutDraggableOptions,
			Widget: WidgetDraggableOptions,
			Frame: FrameDraggableOptions,
			Photo: PhotoDraggableOptions,
			PhotoInPage: PhotoInPageDraggableOptions
		}
	}

})(PB);
