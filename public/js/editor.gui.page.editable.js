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
		flavors: ['frame', 'photo'],
		enter: function($dom, flavor, transferData, handoff) {
			this.page = PB.Page.Selection.findClosest($dom).bookPage;
			this.page.startTemporaryChanges();
			this.assetId = $dom.data('model_id');
			this.dom = $dom;
			this.dropFlavor = flavor;
			var asset = this.page.getAsset( this.assetId );
			switch( this.dropFlavor ) {
				case 'frame':
					if (handoff) {
						this.oldFrameId = handoff.oldFrameId,
						this.oldFrameData = handoff.oldFrameData
					}
					else {
						this.oldFrameId = asset.frameId;
						this.oldFrameData = asset.frameData;
						this.page.updateAsset( this.assetId, {
							frameId: transferData
						});
					}
				break;
				case 'photo': {
					if (handoff) {
						$.extend(this, handoff);
					}
					else {
						this.oldPhotoId = asset.photoId;
						this.oldZoom = asset.zoom;
						this.oldPhotoRect = asset.photoRect;
						this.oldFocalPoint = asset.focalPoint;
						this.page.updateAsset(this.assetId, {
							photoId: transferData,
							zoom: 1.0,
							focalPoint: null
						});
					}
				}
			}
		},
		leave: function(handoffAssetId) {
			switch( this.dropFlavor ) {
				case 'frame':
					if (handoffAssetId == this.assetId) {
						return {
							oldFrameId: this.oldFrameId,
							oldFrameData: this.oldFrameData
						}
					}
				 	if ('oldFrameId' in this) {
						this.page.updateAsset( this.assetId, {
							frameId: this.oldFrameId,
							frameData: this.oldFrameData
						});
					}
				break;
				case 'photo':
					if (handoffAssetId == this.assetId) {
						return {
							oldPhotoId: this.oldPhotoId,
							oldZoom: this.oldZoom,
							oldPhotoRect: this.oldPhotoRect,
							oldFocalPoint: this.oldFocalPoint
						}
					}
					if ('oldPhotoId' in this) {
						this.page.updateAsset( this.assetId, {
							photoId: this.oldPhotoId,
							zoom: this.oldZoom,
							photoRect: this.oldPhotoRect,
							focalPoint: this.oldFocalPoint
						});
					}
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
			$dom.find('img').on('dragstart', function(ev) { ev.preventDefault(); return false;});
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
			Photo: PhotoDraggableOptions
		}
	}

})(PB);
