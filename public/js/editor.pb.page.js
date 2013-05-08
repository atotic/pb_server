// editor.pb.page.js

/* DATA DICTIONARY

BookPage JSON {
	needReflow: false
	assets: [ asset_id*],
	assetData: { asset_id : {asset}},
	designId: null,
	layoutId: null,
	layoutData: null,
	backgroundId: null,
	backgroundData: null,
}
}
all assets {
	type: 'photo', 'text'
	top
	left
	width
	height
	rotate	// angle in degrees
	zindex // default 0
	frameId
	frameData
	frameOffset [ t,r,b,l] or offset. Use canonicalFrameOffset to convert to canonical form
}
asset photo {
	type: 'photo'
	photoId
	focalPoint { xy %, default 50}
	zoom { 1.0,}
	photoRect { tlwh } // automatically generated
}
asset text {
	type: 'text'
	content: '' // plain text
}
asset widget {
	type: 'widget'
	widgetId:
	widgetOptions:
}
*/

(function(scope){

"use strict";

	function registerPageAssetResolver(pageProxy, assetId) {
		var book = pageProxy.book;
		PB.ModelMap.setResolver( assetId, function() {
			var page = book.page(pageProxy.id);
			var item = page.p.assetData[assetId];
			if (!item)
				PB.debugstr("Resolving item not there");
			return { page: page, item: item, itemId: assetId };
		});
	};
	var PageProxy = function(id, book) {
		this.id = id;
		this.book = book;
		PB.ModelMap.setResolver(id, book.pageResolver());
		this.p.assets.forEach(function(assetId) {
			registerPageAssetResolver(this, assetId );
		}, this);
	};


	var coverRegex = /^cover|^cover-flap|^back-flap|^back/;

	PageProxy.prototype = {
		get p() {
			return this.book.localData.document.pages[this.id];
		},
		get layoutId() {
			debugger;
			return this.book.localData.document.pages[this.id].layoutId;
		},
		get layout() {
			debugger;
		},
		set layoutId(val) {
			debugger;
		},
		getEditMenu: function(layoutItemId) {
			debugger;
		},
		isDraggable: function() {
			return this.id.match(coverRegex) === null;
		},
		isDroppable: function(flavor) {
			switch(flavor) {
			case 'roughPage':
			case 'addRoughPage':
				return this.type() != 'cover';
			default:
				return true;
			}
		},
		type: function() {
			debugger; // should use getPageClass
			if ( this.id.match(coverRegex))
				return 'cover';
			else
				return 'pages';
		},

		// indexOf this page inside the book
		indexOf: function() {
			return this.book.pageList.indexOf(this.id);
		},
		get pageClass() {
			if ( this.id.match(coverRegex))
				return this.id;
			else
				return 'page';
		},
		pageTitle: function() {
			switch(this.id) {
				case 'cover': return 'cover';
				case 'cover-flap': return 'flap';
				case 'back-flap': return 'flap';
				case 'back': return 'back';
				default:
					return this.book.pageList.indexOf(this.id) - 3;
			}
		},
		swapPhoto: function(oldId, newId) {
			this.p.assetData.forEach(function(assetData) {
				if (assetData.type === 'photo' && assetData.photoId == oldId)
					assetData.photoId = newId;
			});
		},

		get photoList() {
			debugger;
		},
		remove: function(options) {
			this.book.deleteRoughPage(this, options);
		},
		getAssetData: function(assetId) {
			return this.p.assetData[ assetId];
		},
		getAssetIds: function(itemType) {
			var retVal = [];
			for (var i=0; i<this.p.assets.length; i++) {
				var itemId = this.p.assets[i];
				if (!itemType || this.p.assetData[itemId].type == itemType)
					retVal.push(itemId);
			}
			return retVal;
		},
		// NEW FUNCTIONS
		get width() {
			debugger;
		},
		get height() {
			debugger;
		},
		get dimensions() {
			return this.book.getPageDimensions(this.id, this.pageClass);
		},
		dimensionsChanged: function(width, height) {
			this.p.needReflow = true;
			PB.broadcastChange(this, 'dimensions');
		},
		addAsset: function(id, assetData, options) {
			this.p.assets.push(id);
			this.p.assetData[id] = assetData;
			this.p.needReflow = true;
			registerPageAssetResolver(this, id);
			if (assetData.type == 'photo')
				this.book._pagePhotosChanged(this, options);
			PB.broadcastChange(this, 'assets',
				$.extend( {assetId: id}, options ));
		},
		removeAsset: function(id, options) {
			var idx = this.p.assets.indexOf(id);
			if (idx == -1)
				return PB.debugstr("removing non-exhistent asset");
			this.p.assets.splice(idx, 1);
			var assetData = this.p.assetData[id];
			delete this.p.assetData[id];
			this.p.needReflow = true;
			PB.ModelMap.unsetResolver(id);
			if (assetData.type == 'photo')
				this.book._pagePhotosChanged(this, options);
			PB.broadcastChange(this, 'assets', options);
		},
		updateAssetData: function(id, newData, options) {
			function myExtend(src, dest) {
				var dirty = false;
				for (var prop in src) {
					switch ($.type(src[prop])) {
						case 'array':
							dest[prop] = src[prop].slice(0);
							dirty = true;
						break;
						case 'object':
							if (typeof dest[prop] !== 'object') {
								dirty = true;
								dest[prop] = {}
							}
							dirty = myExtend( src[prop], dest[prop] ) || dirty;
						break;
						default:
							if ( src[prop] !== dest[prop] ) {
								dest[prop] = src[prop];
								dirty = true;
							}
						break;
					}
				}
				return dirty;
			}

			options = $.extend({
				clobber: false	// clobbers all existing data
			}, options);

			if (!(id in this.p.assetData))
				return PB.debugstr("Updating non-existent asset data");

			var dirty = false;

			if (options.clobber) {
				dirty = true;
				this.p.assetData[id] = PB.clone(newData);
			}
			else
				dirty = myExtend( newData, this.p.assetData[id] );

			// optimize: if data does not change, do not broadcast changes. Useful for manipulators
			if (dirty) {
				this.layoutInnerItem(id);
				PB.broadcastChange({id: id}, 'alldata', options);
			}
		},
		addPhoto: function(id, options) {
			if ((typeof id) != 'string')
				return PB.debugstr("illegal argument to addPhoto");
			var data = {
				type: 'photo',
				photoId: id
			};
			this.addAsset(this.book.generateId(), data);
		},
		addText: function(content) {
			this.addAsset(this.book.generateId(), {
				type: 'text',
				content: content
			});
		},
		addWidget: function(widgetId, widgetOptions) {
			this.addAsset( this.book.generateId(), {
				type: 'widget',
				widgetId: widgetId,
				widgetOptions: widgetOptions
			});
		},
		setLayout: function(layoutId, layoutData, options) {
			this.p.layoutId = layoutId;
			this.p.layoutData = layoutData;
			this.p.needReflow = true;
			PB.broadcastChange(this, 'layoutId', options);
		},
		setBackground: function(backgroundId, backgroundData, options) {
			this.p.backgroundId = backgroundId;
			this.p.backgroundData = backgroundData;
			PB.broadcastChange(this, 'backgroundId', options);
		},
		enclosingDom: function(options) {
			var d = this.dimensions;
			return $(document.createElement('div'))
					.addClass('design-page');
		},
		// focal point range for images
		getFocalPointRange: function(itemId) {
			if ( !( itemId in this.p.assetData ))
				return PB.debugstr("layoutInnerItem on non-existent item");
			var assetData = this.p.assetData[itemId];
			if (this.p.needReflow)
				return { x: { min:0, max: 100 }, y: {min:0, max:100}};
			var innerRect = new GUI.Rect(assetData);
			if (assetData.frameId)
				innerRect = innerRect.inset(assetData.frameOffset);
			var xdelta = innerRect.width * 100 / 2 / assetData.photoRect.width;
			var ydelta = innerRect.height * 100 / 2 / assetData.photoRect.height;
			return { x: { min: xdelta, max: 100 - xdelta },
					y: { min: ydelta, max: 100 - ydelta }};
		},
		layoutInnerItem: function(itemId) {
			if ( !( itemId in this.p.assetData ))
				return PB.debugstr("layoutInnerItem on non-existent item");

			var assetData = this.p.assetData[itemId];
			switch(assetData.type) {
				case 'photo':
					var innerRect = new GUI.Rect(assetData);
					if (assetData.frameId)
						innerRect = innerRect.inset(assetData.frameOffset);

					var zoom = Math.max( assetData.zoom || 1, 1);
					var focalPoint = assetData.focalPoint || { x: 50, y: 50 };

					var photo = PB.ServerPhotoCache.get( assetData.photoId );
					var photoRect = new GUI.Rect( photo );
					var scale = photoRect.fillInside( innerRect);
					photoRect = photoRect.scaleBy( scale ).scaleBy( zoom );
					photoRect = photoRect.centerIn(innerRect,
						{focalPoint: focalPoint,
							forceInside: true }).round();
					if ((typeof assetData.photoRect) != 'object')
						assetData.photoRect = {};
					$.extend(assetData.photoRect, {
						top: photoRect.top,
						left: photoRect.left,
						width: photoRect.width,
						height: photoRect.height
					});
				break;
				case 'text':
				break;
				case 'widget':
				break;
				default:
				console.warn("not updating item inner of type ", assetData.type);
				break;
			}
		},
		layoutFromDesign: function() {
			// reconcile existing layout with layout from design
			this.p.needReflow = true;
			if (!this.p.layoutId)
				return;
			var resource = PB.ThemeCache.resource( this.p.layoutId );
			var d = this.dimensions;
			var layout = resource.getPageLayout( this.p.assetData, d.width, d.height, this.p.layoutData);

			var THIS = this;
			// console.log( PB.ThemeUtils
			// 		.generateLayoutId(resource, 'test', d.width, d.height, this.p.assetData)
			// 	);
			this.p.assets.forEach( function( assetId ) {
				var assetData = THIS.p.assetData[ assetId ];

				var assetDesign;
				switch ( assetData.type ) {
					case 'photo':
						assetDesign = layout.photos.length > 0 ? layout.photos.shift() : null;
						break;
					case 'text':
						assetDesign = layout.texts.length > 0 ? layout.texts.shift() : null;
						break;
					case 'widget':
						break;
					default:
						console.error('unknown assetData type', assetData.type );
				}
				if ( assetDesign == null ) {
					if ('top' in assetData)
						assetDesign = assetData;
					else {
						var d = THIS.dimensions;
						var center = { x: d.width / 2, y: d.height / 2 };
						var defaultWidth, defaultHeight;
						switch( assetData.type ) {
							case 'text':
								defaultWidth = d.width / 3;
								defaultHeight = 30;
							break;
							case 'widget':
								var widget = PB.ThemeCache.resource( assetData.widgetId );
								defaultHeight = widget.defaultHeight( assetData.widgetOptions );
								defaultWidth = widget.defaultWidth( assetData.widgetOptions );
							break;
							default:
								console.error("no assetDesing for ", assetData.type);
							return;
						}
						assetDesign = {
							top: center.y - defaultHeight / 2,
							left: center.x - defaultWidth / 2,
							width: defaultWidth,
							height: defaultHeight
						};
					}
				}
				$.extend(assetData, {
					top: assetDesign.top,
					left: assetDesign.left,
					width: assetDesign.width,
					height: assetDesign.height,
					rotate: assetDesign.rotate || 0
				});
				if (assetDesign.frameId) {
					assetData.frameId = assetDesign.frameId;
					assetData.frameOffset = assetDesign.frameOffset;
					assetData.frameData = assetDesign.frameData;
				}
				else {
					delete assetData.frameId;
					delete assetData.frameOffset;
					delete assetData.frameData;
				}
				if ('zindex' in assetDesign)
					assetData.zindex = assetDesign.zindex;
				else
					assetData.zindex =
						assetData.type == 'text' ? 2 :
						assetData.type == 'widget' ? 1 : 0;
				THIS.layoutInnerItem( assetId );
			});

			// if (design.background) {
			// 	this.p.backgroundId = design.background.backgroundId;
			// 	this.p.backgroundData = design.background.backgroundData;
			// }

			this.p.needReflow = false;

		},
		generateBackgroundDom: function(options) {
			var $div = $( document.createElement('div') )
				.addClass('design-background');
			PB.ThemeCache.resource( this.p.backgroundId ).fillBackground( $div, this.p.backgroundData, options );
			return $div;
		},
		generateFrame: function(asset, options) {
			var innerBounds = new GUI.Rect({width: asset.width, height: asset.height});
			if (!asset.frameId)
				return { frame: null, innerBounds: innerBounds};
			innerBounds = innerBounds.inset(asset.frameOffset);

			var frame = $(document.createElement('div'))
				.addClass('design-frame')
				.css({
					width: asset.width,
					height: asset.height
				});
			PB.ThemeCache.resource(asset.frameId).fillFrame(frame, asset.frameOffset, asset.frameData, options);
			return { frame: frame, innerBounds: innerBounds};
		},
		/*
			widgetDom
			div.design-widget tlwh	// photo with frame
				div.design-widget-frame top: 0, left: 0, width: height:
				div.design-widget-inner top: left: width: height: // widget, no overflow, position absolute
		*/
		generateWidgetDom: function( asset, options) {
			var frameOffset = [0,0,0,0];

			if ( asset.frameId )
				frameOffset = asset.frameOffset;

			var widgetDom = $(document.createElement('div'))
				.addClass('design-widget')
				.css({
					top: asset.top,
					left: asset.left,
					width: asset.width,
					height: asset.height
				});
			var fr = this.generateFrame(asset, options);
			var innerFrame = fr.innerBounds;
			if (fr.frame)
				widgetDom.append( fr.frame );

			var widget = PB.ThemeCache.resource( asset.widgetId );
			var innerDom = widget.generateDom( innerFrame.width, innerFrame.height, asset.widgetOptions)
				.addClass( 'design-widget-inner' )
				.css( {
					top: innerFrame.top,
					left: innerFrame.left,
					width: innerFrame.width,
					height: innerFrame.height
				});
			widgetDom.append( innerDom );
			return widgetDom;
		},
		getText: function(asset) {
			if (((typeof asset.content) == 'string') && asset.content != '')
				return asset.content;
			else
				return undefined;
		},
		/* textDom
			div.design-text tlwh
				div.design-frame
				div.design-text-content
		*/
		generateTextDom: function(asset, options) {
			// measure height of the text
			var textRect = {
				top: asset.top,
				left: asset.left,
				width: asset.width,
				height: 'auto'
			};

			var frameOffset = [0,0,0,0];

			if ( asset.frameId )
				frameOffset = asset.frameOffset;

			textRect.width -= frameOffset[1] + frameOffset[3];

			var originalText = this.getText( asset );
			var text = originalText || "Type your text here";

			var measureText = $(document.createElement('div'))
				.addClass('design-text-content')
				.css ( textRect )
				.text( text );
			var heights = GUI.Util.getTextHeight(measureText);

			// resize asset to just fit the text
			asset.height = heights.divheight + frameOffset[0] + frameOffset[2];

			var textDom = $(document.createElement('div'))
				.addClass('design-text')
				.css ({
					top: asset.top,
					left: asset.left,
					width: asset.width,
					height: asset.height
				 });
			var fr = this.generateFrame(asset, options);
			var innerFrame = fr.innerBounds;
			if (fr.frame)
				textDom.append(fr.frame);

			var contentDom = $(document.createElement('div'))
				.addClass('design-text-content')
				.css({
					top:innerFrame.top,
					left: innerFrame.left,
					width: innerFrame.width,
					height: innerFrame.height
				})
				.text( text );
			if (originalText == null)
				contentDom.css('color', '#999');
			textDom.append( contentDom );
			return textDom;
		},
		/*
			photoDom
			div.design-photo tlwh	// photo with frame
				div.design-photo-frame top: 0, left: 0, width: height:
				div.design-photo-inner top: left: width: height: // photo enclosure, no overflow, position absolute
					img.design-photo-img top: left: width: height: // just photo
		*/
		generatePhotoDom: function(asset, options) {
			var photoDom = $(document.createElement('div'))
				.addClass('design-photo')
				.css({
					top: asset.top,
					left: asset.left,
					width: asset.width,
					height: asset.height
				});
			var fr = this.generateFrame(asset, options);
			var innerFrame = fr.innerBounds;
			if (fr.frame)
				photoDom.append( fr.frame );
			var innerDom = $( document.createElement('div') )
				.addClass( 'design-photo-inner' )
				.css( {
					top: innerFrame.top,
					left: innerFrame.left,
					width: innerFrame.width,
					height: innerFrame.height
				});
			var imgDom = $( document.createElement('img') )
				.addClass('design-photo-img')
				.prop('src', PB.ServerPhotoCache.get( asset.photoId).url )
				.css({
					top: asset.photoRect.top,
					left: asset.photoRect.left,
					width: asset.photoRect.width,
					height: asset.photoRect.height
				});
			photoDom.append( innerDom.append( imgDom ) );
			return photoDom;
		},
		/*
		.design-book-page-left
			.design-page, css transform(scale), width, height
				.design-background
				.design-photo
				.design-text
		*/
		generateDom: function(options) {
			options = $.extend({
				syncable: false,	// sync dom to changes
				editable: false,	// expose edit ui
				enclosingDom: null	// old dom to
			}, options);
			var $encloseDom = options.enclosingDom || this.enclosingDom( options );
			var d = this.dimensions;
			$encloseDom.css({
				width: d.width,
				height: d.height
			});
			function insertAfterHelper($parent, $target,  $element) {
				if ($target == null)
					$parent.prepend($element);
				else
					$element.insertAfter($target);
			};
			if (this.p.needReflow)
				this.layoutFromDesign();

			if (!this.p.needReflow)
			{
				// generate all parts of the page
				// this routine is also used to refresh parts of the page
				// if old enclosing dom is passed in with parts removed, only the missing parts are regenerated
				var $nextDomSlot = null;
				if (this.p.backgroundId) {
					var $background = $encloseDom.find('.design-background');
					if ( $background.length == 0 ) {
						$background = this.generateBackgroundDom( options );
						insertAfterHelper( $encloseDom, $nextDomSlot, $background );
					}
					$nextDomSlot = $background;
				}
				for (var i=0; i < this.p.assets.length; i++) {
					var item = this.p.assetData[ this.p.assets[i] ];
					var $itemDom = $encloseDom.find('*:data("model_id=' + this.p.assets[i] + '")');
					if ( $itemDom.length != 0 ) {
						$nextDomSlot = $itemDom;
						continue;
					}
					switch(item.type) {
						case 'photo':
							$itemDom = this.generatePhotoDom( item, options );
							break;
						case 'text':
							$itemDom = this.generateTextDom( item, options );
							break;
						case 'widget':
							$itemDom = this.generateWidgetDom( item, options );
							break;
						default:
							debugger;
					}
					if (item.rotate)
						$itemDom.css('transform', 'rotate(' + item.rotate + 'deg)');
					if (item.zindex)
						$itemDom.css('zIndex', item.zindex);
					insertAfterHelper( $encloseDom, $nextDomSlot, $itemDom );
					$nextDomSlot = $itemDom;

					if (options.editable || options.syncable)
						$itemDom.data( 'model_id', this.p.assets[i] );
					if (options.editable)
						this.makeEditable( item, $itemDom );
					if (options.syncable)
						this.makeItemSyncable( this, $itemDom, options );
				}
			}
			else
				$encloseDom.text("Design not available." + this.p.assets.length + " items on this page");
			if ( options.editable && !options.enclosingDom) {
				$encloseDom.hammer().on( 'touch', {}, function(ev) {
					PageSelection.findInParent($encloseDom).setSelection();
				});
				PageSelection.bindToDom( this, $encloseDom )
			}
			if (options.editable)
				PageSelection.findInParent($encloseDom).relayout();
			if ( options.syncable && !options.enclosingDom )
				this.makePageSyncable( $encloseDom, options );
			return $encloseDom;
		}
	};


	['getEditMenu',
		'dom',
		'addItem',
		'removeItem',
		'allItems',
		'itemsByType',
		'item',
		'photos'
		].forEach(
		function(name) {
			PageProxy.prototype[name] = function() {
				console.error("Removed function called", name);
				debugger;
			}
		});

	PageProxy.blank = function(book) {
		return {
			id: book.generateId(),
			assets: [],
			assetData: {},
			backgroundId: null,
			backgroundData: null,
			layoutId: null,
			layoutData: null,
			needReflow: true
		}
	};

	var Popups = {
		getManipulatorCommandSet: function() {
			if ('cmdSet' in this)
				return this.cmdSet;
			this.cmdSet = new GUI.CommandSet('manipulators');

			this.cmdSet.add( new GUI.Command ({
				id: 'move',
				title: 'move',
				icon: 'move',
				action: function( $pageDom, itemId ) {
					var m = new GUI.Manipulators.Move( $pageDom, itemId );
					PageSelection.findInParent( $pageDom ).setManipulator( m );
				}
			}));
			this.cmdSet.add( new GUI.Command({
				id: 'pan',
				title: 'pan',
				icon: 'hand-up',
				action: function( $pageDom, itemId) {
					var m = new GUI.Manipulators.Pan( $pageDom, itemId );
					PageSelection.findInParent( $pageDom ).setManipulator( m );
				}
			}));
			this.cmdSet.add( new GUI.Command({
				id: 'zoom',
				title: 'zoom',
				icon: 'search',
				action: function( $pageDom, itemId) {
					var m = new GUI.Manipulators.Zoom( $pageDom, itemId );
					PageSelection.findInParent( $pageDom ).setManipulator( m );
				}
			}));
			this.cmdSet.add( new GUI.Command({
				id: 'resize',
				title: 'resize',
				icon: 'arrow-up',
				action: function( $pageDom, itemId) {
					var m = new GUI.Manipulators.Resize( $pageDom, itemId );
					PageSelection.findInParent( $pageDom ).setManipulator( m );
				}
			}));
			this.cmdSet.add( new GUI.Command({
				id: 'resizeHorizontal',
				title: 'resize',
				icon: 'arrow-up',
				action: function( $pageDom, itemId) {
					var m = new GUI.Manipulators.Resize( $pageDom, itemId ,{ vertical: false });
					PageSelection.findInParent( $pageDom ).setManipulator( m );
				}
			}));
			this.cmdSet.add( new GUI.Command({
				id: 'resizeFixAspect',
				title: 'resize',
				icon: 'arrow-up',
				action: function( $pageDom, itemId) {
					var m = new GUI.Manipulators.Resize( $pageDom, itemId ,{ fixAspect: true });
					PageSelection.findInParent( $pageDom ).setManipulator( m );
				}
			}));
			this.cmdSet.add( new GUI.Command({
				id: 'rotate',
				title: 'rotate',
				icon: 'repeat',
				action: function( $pageDom, itemId) {
					var m = new GUI.Manipulators.Rotate( $pageDom, itemId );
					PageSelection.findInParent( $pageDom ).setManipulator( m );
				}
			}));
			this.cmdSet.add( new GUI.Command({
				id: 'editText',
				title: 'edit',
				icon: 'edit',
				action: function( $pageDom, itemId) {
					var m = new GUI.Manipulators.EditText( $pageDom, itemId );
					PageSelection.findInParent( $pageDom ).setManipulator( m );
				}
			}));
			this.cmdSet.add( new GUI.Command({
				id: 'remove',
				title: 'remove',
				icon: 'remove',
				key: GUI.CommandManager.keys.backspace,
				action: function($pageDom, itId) {
					// when deletekey is pressed, $pageDom and itId are null
					PageSelection.forEach(function( page, itemId, pageSelection) {
						if ($pageDom != null || pageSelection.manipulator == null) {
							pageSelection.setSelection();
							page.removeAsset( itemId );
						}
					});
				}
			}));
			return this.cmdSet;
		},
		makeLiAction: function(cmd) {
			$li = $( document.createElement( 'li' ));
			var $a = $( document.createElement('span'));
			$a.text( cmd.title );
			if ( cmd.icon )
				$a.prepend( $.parseHTML("<i class='icon-" + cmd.icon + "'></i>" ));
			$a.hammer().on("touch", function(ev) {
					try {
						var $popup = $a.parents('.pb-popup-menu');
						var pageItem = PB.ModelMap.model($popup.data('popupModel'));
						var $pageDom = $popup.data("popupPageDom");
						cmd.action( $pageDom, pageItem.itemId );
					}
					catch(ex) {
						console.error(ex);
					}
					PB.stopEvent(ev);
				});
			$li.append($a);
			return $li;
		},
		popupShell: function() {
			return $('<ul>').addClass('pb-popup-menu');
		},
		photoPopup: function() {
			var $popup = this.popupShell();
			var cmdSet = this.getManipulatorCommandSet();
			var localCmdSet = new GUI.CommandSet('photoPopup');
			['move', 'pan', 'zoom', 'resize', 'rotate', 'remove']
				.forEach( function(cmdId) {
					var cmd = cmdSet.getCommandById( cmdId );
					localCmdSet.add( cmd );
					var $li = Popups.makeLiAction( cmd );
					$popup.append($li);
			});
			localCmdSet.add( cmdSet.getCommandById( 'remove'));
			$popup.data('commandSet', localCmdSet);
			return $popup;
		},
		textPopup: function() {
			var $popup = this.popupShell();
			var cmdSet = this.getManipulatorCommandSet();
			var localCmdSet = new GUI.CommandSet('textPopup');
			['editText', 'move', 'resizeHorizontal', 'rotate', 'remove']
				.forEach( function(cmdId) {
					var cmd = cmdSet.getCommandById( cmdId );
					localCmdSet.add( cmd );
					var $li = Popups.makeLiAction( cmd );
					$popup.append($li);
				});
			localCmdSet.add( cmdSet.getCommandById( 'remove'));
			$popup.data('commandSet', localCmdSet);
			return $popup;
		},
		widgetPopup: function(itemPage) {
			var $popup = this.popupShell();
			var cmdSet = this.getManipulatorCommandSet();
			var localCmdSet = new GUI.CommandSet('widgetPopup');
			['move', 'resizeFixAspect', 'rotate', 'remove']
				.forEach( function(cmdId) {
					var cmd = cmdSet.getCommandById( cmdId );
					localCmdSet.add( cmd );
					var $li = Popups.makeLiAction( cmd );
					$popup.append($li);
				});
			localCmdSet.add( cmdSet.getCommandById( 'remove'));
			$popup.data('commandSet', localCmdSet);
			return $popup;
		}
	}

	var PageProxyEditable = {
		// callback, 'this' points to an HTMLElement, not page
		selectItem: function(pageSelection, itemId, $itemDom) {
			var itemPage = PB.ModelMap.model(itemId);
			var multiTap = pageSelection.selection.some(function(val) { return val == itemId; });
			var $popup;
			switch(itemPage.item.type) {
				case 'photo':
					$popup = Popups.photoPopup();
				break;
				case 'text':
					$popup = Popups.textPopup();
					if (multiTap)
						window.setTimeout(function() {
							var cmd = Popups.getManipulatorCommandSet().getCommandById('editText');
							cmd.action( $itemDom.parents('.design-page'), itemId );
						}, 0);
				break;
				case 'widget':
					$popup = Popups.widgetPopup(itemPage);
				break;
				default:
					console.warn("No menus available over items of type", itemPage.item.type);
			}
			pageSelection.setSelection( itemId, $popup );
		},
		touchCb: function(ev) {
			var $itemDom = $( ev.currentTarget );
			var itemId = $itemDom.data( 'model_id' );
			var pageSelection = PageSelection.findInParent( $itemDom );
			this.selectItem( pageSelection, itemId, $itemDom );
			PB.stopEvent(ev.gesture);
			PB.stopEvent(ev);
		},
		makeEditable: function(item, $itemDom) {
			var THIS = this;
			$itemDom.hammer().on('touch', {}, function(ev) { THIS.touchCb(ev) });
		},
		makeItemSyncable: function(page, $itemDom, options) {
			$itemDom.on( PB.MODEL_CHANGED, function( ev, model, prop, eventOptions ) {
				var $pageDom = $itemDom.parents( '.design-page' );
				$itemDom.remove();
				page.generateDom($.extend( {}, eventOptions, options,
						{enclosingDom: $pageDom }
						));
				PageSelection.findInParent($pageDom).highlight();
				ev.stopPropagation();
			});
		},
		makePageSyncable: function($pageDom, options) {
			$pageDom.data( 'model_id', this.id );
			var THIS = this;
			$pageDom.on( PB.MODEL_CHANGED, function( ev, model, prop, eventOptions ) {
				switch( prop ) {
					case 'backgroundId':
						$pageDom.find('.design-background').remove();
						THIS.generateDom(
							$.extend( {}, eventOptions, options, {enclosingDom: $pageDom} ));
						break;
					case 'assets':
					case 'layoutId':
						var pageSelection = PageSelection.findInParent($pageDom);
						pageSelection.setSelection();
						$pageDom.children().remove();
						THIS.generateDom(
							$.extend( {}, eventOptions, options, {enclosingDom: $pageDom} ));
						if (eventOptions && eventOptions.assetId) {
							THIS.selectItem( pageSelection, eventOptions.assetId );
						}
						break;
					case 'dimensions':
						$pageDom.children().remove();
						THIS.generateDom(
							$.extend( {}, eventOptions, options, {enclosingDom: $pageDom} ));
						break;
					default:
						console.warn("how should I sync ", prop);
						break;
				};
			});
		}
	};

	$.extend(PageProxy.prototype, PageProxyEditable);

	var PageSelection = function(bookPage, dom) {
		this.bookPage = bookPage;
		this.dom = dom;
		this.selection = [];
		this.manipulator = null;
		this.popup = null;
	};
	PageSelection.prototype = {
		setSelection: function(itemId, $popup) {
			this.selection = itemId ? [itemId] : [];
			this.highlight();
			// hide manipulator if from another item
			if (this.manipulator && this.manipulator.itemId != itemId)
				this.setManipulator(null);
			if ($popup != null && $popup.length == 0)
				$popup = null;
			this.setPopup(itemId, $popup);
		},

		highlight: function() {
			this.dom.find('.selected').removeClass('selected');
			for (var i=0; i<this.selection.length; i++)
				this.dom.find('*:data("model_id=' + this.selection[i] + '")').addClass('selected');
		},
		setManipulator: function(manipulator) {
			if (this.manipulator)
				this.manipulator.remove();
			this.manipulator = manipulator;
			if (this.manipulator)
				this.manipulator.show();
		},
		setPopup: function(itemId, $popup) {
			if (this.popup && this.popup != $popup) {
				var cmdSet = this.popup.data('commandSet');
				if (cmdSet) cmdSet.deactivate();
				this.popup.remove();
			}
			this.popup = $popup;
			if (this.popup) {
				this.popup.data("popupModel", itemId );
				this.popup.data("popupPageDom", this.dom );
				$('#pagePopupContainer').append( this.popup );
				this.popup.css({
					right: 0,
					left: 'auto'
				});
				var cmdSet = this.popup.data('commandSet');
				if (cmdSet) cmdSet.activate();
				this.popup.show();
			}
		},
		relayout: function() {
			if (this.manipulator)
				this.manipulator.reposition();
		}
	};


	PageSelection.DATA_ID = 'pageSelection';
	PageSelection.findInParent = function($dom) {
		var ps = $dom.parents( '*:data("pageSelection")' ).data(PageSelection.DATA_ID);
		ps = ps || $dom.data(PageSelection.DATA_ID);
		if (ps == null) {
			console.error("could not find pageselection in ", $dom);
			throw "Could not find pageselection";
		}
		return ps;
	};

	PageSelection.bindToDom = function(page, $dom) {
		var sel = $dom.data(PageSelection.DATA_ID);
		if (sel) {
			sel.highlight();
		}
		else {
			sel = new PageSelection(page, $dom);
			$dom.data(PageSelection.DATA_ID, sel);
		}
		return sel;
	};

	// return [PageSelection]
	PageSelection.getActiveSelections = function() {
		var retVal = [];
		$('.selected').each(function() {
			var s = PageSelection.findInParent($(this));
			if (s)
				retVal.push(s);
		});
		return retVal;
	};

	// callback(PB.PageProxy, itemId)
	PageSelection.forEach = function(callback) {
		this.getActiveSelections()
			.forEach( function( pageSel ) {
				pageSel.selection.forEach( function( itemId ) {
					callback(pageSel.bookPage, itemId, pageSel);
				});
			});
	};

	$(document).on('click', function(ev) {
		if (ev.target.nodeName == 'BODY' || ev.target.nodeName == 'HTML')
			PageSelection.getActiveSelections().forEach( function( sel ) {
				sel.setSelection();
			});
	});

	scope.PageProxy = PageProxy;
	scope.PageSelection = PageSelection;

})(PB);
/*
// PB.OldPageProxy
(function(scope) {
	"use strict";

/*
Page data design
photo_id => PB.ServerPhoto. globally unique, sql server id
						fetch with PB.ServerPhotoCache.get(photo_id)
           	warning: can mutate while image is being saved
background_id => PB.Template.Background, background template.
						fetch with PB.Template.get
text_id => Points to an object in page: page.texts[text_id]. Page unique, not global

	Page json => {
		id:
		itemList: [local_id*]
		items: {
			local_id: {
				type: photo|widget|text
				resource_id:
				top:
				left:
				width:
				height:
				layout_data: {
				}
			}*
		}

// OLD
		photoList: [photo_id*]
		layoutId:
		layoutData: {
			// layout dependent. suggested:
			object_id => {
				layout data
			}
		}
		background: background_id
		textList: [text_id*]
		texts: {
			id => {
				text:
				font:
				size:
		}
		photoLayout: {
			id => {
				top
				left
				width
				height
			}*
		}
	}
*
	var PageProxy = function(id, book) {
		this.id = id;
		this.book = book;
		PB.ModelMap.setResolver(id, book.pageResolver());
	}

	var coverRegex = /^cover|^cover-flap|^back-flap|^back/;
	PageProxy.prototype = {
		get p() {
			return this.book.localData.document.pages[this.id];
		},
		get layoutId() {
			return this.book.localData.document.pages[this.id].layoutId;
		},
		get layout() {
			var id = this.book.localData.document.pages[this.id].layoutId;
			if (id)
				return PB.Template.cached(id);
			else
				return null;
		},
		set layoutId(val) {
			if (val != this.book.localData.document.pages[this.id].layoutId) {
				this.book.localData.document.pages[this.id].layoutId = val;
				this.book._pageChanged(this);
				PB.broadcastChange(this, 'layoutId');
			}
		},
		getEditMenu: function(layoutItemId) {
			return this.layout.getEditMenu(this, layoutItemId);
		},
		isDraggable: function() {
			return this.id.match(coverRegex) === null;
		},
		isDroppable: function(flavor) {
			switch(flavor) {
			case 'roughPage':
			case 'addRoughPage':
				return this.type() != 'cover';
			default:
				return true;
			}
		},
		type: function() {
			if ( this.id.match(coverRegex))
				return 'cover';
			else
				return 'pages';
		},
		// indexOf this page inside the book
		indexOf: function() {
			return this.book.pageList.indexOf(this.id);
		},
		get pageClass() {
			if ( this.id.match(coverRegex))
				return this.id;
			else
				return 'page';
		},
		pageTitle: function() {
			switch(this.id) {
				case 'cover': return 'cover';
				case 'cover-flap': return 'flap';
				case 'back-flap': return 'flap';
				case 'back': return 'back';
				default:
					return this.book.pageList.indexOf(this.id) - 3;
			}
		},
		dom: function(resolution) {
			if (!this.layoutId)
				this.book.assignTemplate(this);
			if (!this.layoutId)
				throw "no dom yet";
			return PB.Template.cached(this.layoutId).generateDom(this, {resolution: resolution});
		},
		guessItemType: function(item) {
			if (item instanceof PB.PhotoProxy)
				return 'photo';
			else if (item instanceof PB.ServerPhoto)
				return 'serverPhoto';
			else {
				console.warn("Unknown item type:", item);
				throw new Error("Unknown item type");
			}
		},
		get _itemList() {
			return this.book.localData.document.pages[this.id].itemList;
		},
		get _items() {
			return this.book.localData.document.pages[this.id].items;
		},
		addItem: function(item, options) {
			var newId = this.book.generateId();
			var itemType = this.guessItemType(item);
			this._itemList.push(newId);
			Object.defineProperty(this._items, newId, {
				value: {
					type: itemType,
					resource_id: item.id,
					id: newId
				},
				enumerable: true,
				writable: true,
				configurable: true
			});
			if (itemType == 'photo')
				this.book._pagePhotosChanged(this, options);
			PB.broadcastChange(this, 'itemList', options);
		},
		removeItem: function(removeItem, options) {
			var itemList = this._itemList;
			var items = this._items;
			for (var i=0; i<itemList.length; i++)
				if (items[itemList[i]].resource_id == removeItem.id) {
					var isPhoto = items[itemList[i]].type == 'photo';
					delete items[itemList[i]];
					itemList.splice(i, 1);
					PB.broadcastChange(this, 'itemList', options);
					if (isPhoto)
						this.book._pagePhotosChanged(this, options);
					return;
				}
			throw new Error("no such item");
		},
		allItems: function() {
			var items = this._items;
			return this._itemList.map(function(item_id) {
				return items[item_id];
			});
		},
		itemsByType: function(type) {
			var itemList = this._itemList;
			var items = this._items;
			var THIS = this;
			return itemList
				.filter(function(item_id) {
					return items[item_id].type == type;
				})
				.map(function(item_id) {
					return items[item_id];
				});
		},
		item: function(id) {
			return this._items[id]
		},
		addPhoto: function(photo, options) {
			if (photo === null)
				return;
			this.addItem(photo, options);
		},
		removePhoto: function(photo, options) {
			this.removeItem(photo, options);
		},
		swapPhoto: function(oldId, newId) {
			var itemList = this._itemList;
			var idx = itemList.indexOf(oldId);
			if (idx == -1)
				return;
			var items = this._items;
			itemList[idx] = newId;
			items[newId] = items[oldId];
			delete items[oldId];
		},
		get photoList() {
			debugger;
			return this.book.localData.document.pages[this.id].photoList;
		},
		photos: function() {
			var THIS = this;
			return this.itemsByType('photo').map(function(item) {
				return THIS.book.photo(item.resource_id);
			});
		},
		remove: function(options) {
			this.book.deleteRoughPage(this, options);
		}
	}
	PageProxy.blank = function(book) {
		return {
			id: book.generateId(),
			itemList: [],
			items: {}
		};
	}

//	scope.PageProxyOld = PageProxy;
})(window.PB);
*/
