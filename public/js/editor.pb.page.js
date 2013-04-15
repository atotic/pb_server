// editor.pb.page.js

/* DATA DICTIONARY

BookPage JSON {
	width: 768,
	height: 512,
	assets: [ asset_id*],
	assetData: { asset_id : {asset}},
	backgroundId: null,
	backgroundData: null,
	layoutId: null,
	layoutData: null,
	hasLayout: false
}
}
all assets {
	type: 'photo', 'text'
	top
	left
	width
	height
	rotate	// angle in degrees
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
*/

(function(scope){

"use strict";

	function LoadImageDeferred(src) {
		var retval = $.Deferred();
		var img = new Image();
		img.onload = function() {
			retval.resolve(img);
		};
		img.onerror = function(a,b,c) {
			debugger;
			// we report error by resolving as null
			// This allows us to chain deferreds with $.when without aborting on first failure
			retval.resolve(null);
		};
		img.src = src;
		return retval;
	};


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
			return this.p.width;
		},
		get height() {
			return this.p.height;
		},

		addAsset: function(id, assetData, options) {
			this.p.assets.push(id);
			this.p.assetData[id] = assetData;
			this.p.hasLayout = false;
			registerPageAssetResolver(this, id);
			if (assetData.type == 'photo')
				this.book._pagePhotosChanged(this, options);
			PB.broadcastChange(this, 'assets', options);
		},
		removeAsset: function(id, options) {
			var idx = this.p.assets.indexOf(id);
			if (idx == -1)
				return PB.debugstr("removing non-exhistent asset");
			this.p.assets.splice(idx, 1);
			var assetData = this.p.assetData[id];
			delete this.p.assetData[id];
			this.p.hasLayout =false;
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
		setLayout: function(layoutId, layoutData, options) {
			this.p.layoutId = layoutId;
			this.p.layoutData = layoutData;
			this.p.hasLayout = false;
			PB.broadcastChange(this, 'layoutId', options);
		},
		setBackground: function(backgroundId, backgroundData, options) {
			this.p.backgroundId = backgroundId;
			this.p.backgroundData = backgroundData;
			PB.broadcastChange(this, 'backgroundId', options);
		},
		enclosingDom: function(options) {
			return $(document.createElement('div'))
					.addClass('design-page')
					.css({
						width: this.width,
						height: this.height
					});
		},
		// page + layout => canvas icon. Used to draw layout icons
		layoutIcon: function(layoutId, layoutData, maxSize) {
			var l = ThemeCache.resource(layoutId);
			var design = l.getPageDesign(this.p.assetData, this.width, this.height, layoutData);
			var layout = design.layout;

			var enclosure = new GUI.Rect({width: maxSize, height: maxSize});
			var pageRect = new GUI.Rect(this);
			var scale = pageRect.fitInside(enclosure);
			pageRect = pageRect.scaleBy(scale).round();
			var canvas = document.createElement('canvas');
			canvas.width = pageRect.width;
			canvas.height = pageRect.height;
			var context = canvas.getContext('2d');
			// fill background
			context.fillStyle = '#AAA';
			context.fillRect(0,0, pageRect.width, pageRect.height);

			// Load all images as deferred, draw once loadedfgenerate
			function storeResolvedImage(layoutRecord) {
				return function(image) {
					layoutRecord.image = image;
				}
			};
			var imageDeferreds = [];
			var textDeferred;
			var textPattern;
			for (var i=0; i<layout.length; i++) {
				switch(layout[i].type) {
					case 'photo': {
						var loadDef = LoadImageDeferred(PB.FillerPhotos.random(i).url);
						loadDef.done(storeResolvedImage(layout[i]));
						imageDeferreds.push(loadDef);
					}
					break;
					case 'text':
						if (!textDeferred) {
							textDeferred = LoadImageDeferred('/img/abstract-text-pattern.jpg');
							textDeferred.done( function(img) {
								if (img) {
									img.width = 10;
									img.height = 10;
									textPattern = context.createPattern(img,'repeat');
								}
							});
						}
					break;
					default:
					debugger;
				}
			}
			if (textDeferred)
				imageDeferreds.push(textDeferred);
			var allLoadedDef = $.when.apply($, imageDeferreds);

			// When all images load, draw all items
			var FRAME_FILL = '#888';
			var ERROR_FILL = 'red';

			allLoadedDef.always(function() {
				for (var i=0; i<layout.length; i++) {
					var r = new GUI.Rect(layout[i]);
					r = r.scaleBy(scale, true).round();
					var rotatedContext = new GUI.Rotated2DContext(context, layout[i].rotate * Math.PI / 180);
					context.fillStyle = FRAME_FILL;
					rotatedContext.fillRect(r.left, r.top, r.width, r.height);
					if (layout[i].frameId && $.isArray(layout[i].frameOffset)) {
						var frameOffset = layout[i].frameOffset.map(function(v) { return v * scale; });
						r = r.inset(frameOffset);
					}
					switch(layout[i].type) {
						case 'photo': {
							if (layout[i].image) {
								rotatedContext.drawImage(layout[i].image, r.left, r.top, r.width, r.height);
							}
							else {
								context.fillStyle = ERROR_FILL;
								rotatedContext.fillRect(r.left, r.top, r.width, r.height);
								rotatedContext.strokeRect(r.left, r.top, r.width, r.height);
							};
						}
						break;
						case 'text': {
							if (textPattern)
								context.fillStyle = textPattern;
							else
								context.fillStyle = 'yellow';
							rotatedContext.fillRect(r.left, r.top, r.width, r.height);
						}
						break;
						default:
						debugger;
					}
				} // for
			});
			return canvas;
		},
		// focal point range for images
		getFocalPointRange: function(itemId) {
			if ( !( itemId in this.p.assetData ))
				return PB.debugstr("layoutInnerItem on non-existent item");
			var assetData = this.p.assetData[itemId];
			if (this.hasLayout = false)
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
					photoRect = photoRect.centerIn(innerRect, focalPoint).round();
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
				default:
				console.warn("not updating item inner of type ", assetData.type);
				break;
			}
		},
		layoutFromDesign: function() {
			// reconcile existing layout with layout from design
			this.hasLayout = false;
			if (!this.p.layoutId)
				return;
			var resource = ThemeCache.resource(this.p.layoutId);
			var design = resource.getPageDesign(this.p.assetData, this.width, this.height, this.p.layoutData);
			var layout = design.layout;

			var photoAssetIds = this.p.assets.filter( function(val) { return this.p.assetData[val].type == 'photo' }, this );
			var textAssetIds = this.p.assets.filter( function(val) { return this.p.assetData[val].type == 'text' }, this );

			var layoutExhausted = false;
			while (!layoutExhausted) {
				var dd = layout.shift();
				layoutExhausted = (dd == null);
				if (layoutExhausted)
					break;

				var assetId;
				switch(dd.type) {
					case 'photo': {
						var assetId = photoAssetIds.shift();
						if (assetId == null) {
							PB.debugstr("Should add more photos dynamically");
							break;
						}
					}
					break;
					case 'text': {
						var assetId = textAssetIds.shift();
						if (assetId == null) {
							console.error("Should add more text dynamically");
							break;
						}
					}
					break;
					default: {
						console.error("do not know how to handle assets of type", dd.type);
					}
				}
				var assetData = assetData = this.p.assetData[assetId];
				$.extend(assetData, {
					top: dd.top,
					left: dd.left,
					width: dd.width,
					height: dd.height,
					rotate: dd.rotate || 0
				});
				if (dd.frameId) {
					assetData.frameId = dd.frameId;
					assetData.frameOffset = dd.frameOffset;
					assetData.frameData = dd.frameData;
				}
				else {
					delete assetData.frameId;
					delete assetData.frameOffset;
					delete assetData.frameData;
				}
				this.layoutInnerItem(assetId);

			};
			if (photoAssetIds.length > 0 )
				console.error("layout has ignored photo data");
			if (textAssetIds.length > 0)
				console.error("layout has ignored text data");

			if (design.background) {
				this.p.backgroundId = design.background.backgroundId;
				this.p.backgroundData = design.background.backgroundData;
			}
			this.p.hasLayout = true;

		},
		generateBackgroundDom: function(options) {
			var $div = $( document.createElement('div') )
				.addClass('design-background');
			ThemeCache.resource( this.p.backgroundId ).fillBackground( $div, this.p.backgroundData, options );
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
			ThemeCache.resource(asset.frameId).fillFrame(frame, asset.frameOffset, asset.frameData, options);
			return { frame: frame, innerBounds: innerBounds};
		},
		getText: function(asset) {
			if (((typeof asset.content) == 'string') && asset.content != '')
				return asset.content;
			else
				return 'Type your text here';
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

			var text = this.getText( asset );

			var measureText = $(document.createElement('div'))
				.addClass('design-text-content')
				.css ( textRect )
				.text( text );
			var heights = GUI.Util.getTextHeight(measureText);

			// resize asset to just fit the text
			asset.height = heights.divheight + frameOffset[0] + frameOffset[2];

			var designText = $(document.createElement('div'))
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
				designText.append(fr.frame);

			var textContent = $(document.createElement('div'))
				.addClass('design-text-content')
				.css({
					top:innerFrame.top,
					left: innerFrame.left,
					width: innerFrame.width,
					height: innerFrame.height
				})
				.text( text );
			designText.append( textContent );
			return designText;
		},
		/*
			photoDom
			div.design-photo tlwh	// photo with frame
				div.design-photo-frame top: 0, left: 0, width: height:
				div.design-photo-inner top: left: width: height: // photo enclosure, no overflow, position absolute
					img.design-photo-img top: left: width: height: // just photo
		*/
		generatePhotoDom: function(asset, options) {
			var designPhoto = $(document.createElement('div'))
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
				designPhoto.append( fr.frame );
			var designPhotoInner = $( document.createElement('div') )
				.addClass( 'design-photo-inner' )
				.css( {
					top: innerFrame.top,
					left: innerFrame.left,
					width: innerFrame.width,
					height: innerFrame.height
				});
			var img = $( document.createElement('img') )
				.addClass('design-photo-img')
				.prop('src', PB.ServerPhotoCache.get( asset.photoId).url )
				.css({
					top: asset.photoRect.top,
					left: asset.photoRect.left,
					width: asset.photoRect.width,
					height: asset.photoRect.height
				});
			designPhoto.append( designPhotoInner.append( img ) );
			return designPhoto;
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

			function insertAfterHelper($parent, $target,  $element) {
				if ($target == null)
					$parent.prepend($element);
				else
					$element.insertAfter($target);
			};
			if (!this.p.hasLayout)
				this.layoutFromDesign();

			if (this.p.hasLayout)
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
						default:
							debugger;
					}
					if (item.rotate)
						$itemDom.css('transform', 'rotate(' + item.rotate + 'deg)');

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
					console.log("body touch");
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
			width: 768,
			height: 512,
			assets: [],
			assetData: {},
			backgroundId: null,
			backgroundData: null,
			layoutId: null,
			layoutData: null,
			hasLayout: false
		}
	};

	var Popups = {
		makeLiAction: function ($li, title, cmdId) {
			var $a = $(document.createElement('a'));
			$a.text(title);
			$a.prop('href', '/#' + title);
			$a.on("popupClick", function(ev) {
				try {
					var $popup = $a.parents('.pb-popup-menu');
					var pageItem = PB.ModelMap.model($popup.data('popupModel'));
					var $pageDom = $popup.data("popupPageDom");
					pageItem.page.handlePopupCommand( pageItem.itemId, cmdId || title, $pageDom );
					$popup.data("popupModel", null);
					$popup.data("popupPageDom", null);
				}
				catch(ex) {
					console.error(ex);
				}
				PB.stopEvent(ev);
			})
			.on('click', PB.stopEvent);
			$li.append($a);
		},
		photoPopup: function() {
			var $popup = $('#photo-popup');
			if ($popup.length != 0)
				return $popup;
			$popup = $('<ul>').addClass('pb-popup-menu').prop('id', 'photo-popup');
			["move","pan","zoom","resize","rotate","clear"]
				.forEach( function( title ) {
					var $li = $( "<li>" );
					Popups.makeLiAction($li, title);
					$popup.append($li);
				});
			$(document.body).append($popup);
			return $popup;
		},
		textPopup: function() {
			var $popup = $('#text-popup');
			if ($popup.length != 0)
				return $popup;
			var $popup = $('<ul>').addClass('pb-popup-menu').prop('id', 'text-popup');
			["move","resize","edit"]
				.forEach( function( title ) {
					var $li = $( "<li>" );
					Popups.makeLiAction($li, title);
					$popup.append($li);
				});
			$(document.body).append($popup);
			return $popup;
		}
	}

	var PageProxyEditable = {
		handlePopupCommand: function(itemId, cmdId, $pageDom) {
			// find item inside page dom
			// determine item position on the page
			var manipulator;
			var constructor;
			switch(cmdId) {
				case 'move':
					manipulator = new GUI.Manipulators.Move( $pageDom, itemId );
				break;
				case 'pan':
					manipulator = new GUI.Manipulators.Pan( $pageDom, itemId );
				break;
				case 'zoom':
					manipulator =  new GUI.Manipulators.Zoom( $pageDom, itemId );
				break;
				case 'rotate':
					manipulator = new GUI.Manipulators.Rotate( $pageDom, itemId );
				break;
				case 'resize':
					manipulator = new GUI.Manipulators.Resize( $pageDom, itemId );
				break;
				default:
					manipulator = new GUI.Manipulators.Default( $pageDom, itemId );
				break;
			}
			PageSelection.findInParent( $pageDom ).setManipulator( manipulator );
		},
		editItemCb: function(ev) {
			function popupOverElement($popup, $el) {
				$popup.pbPopup('show');
				var elRect = $el.get(0).getBoundingClientRect();
				var popupRect = $popup.get(0).getBoundingClientRect();
				$popup.css({
						position: 'absolute',
						top: Math.max(window.pageYOffset, elRect.top + window.pageYOffset - popupRect.height + 8),
						left: Math.max(window.pageXOffset, elRect.left + window.pageXOffset + 8)
					});
			};
			var $itemDom = $( ev.currentTarget );
			var itemId = $itemDom.data( 'model_id' );
			PageSelection.findInParent( $itemDom )
				.setSelection( itemId );
			// display popup
			var itemPage = PB.ModelMap.model(itemId);
			var $popup;
			switch(itemPage.item.type) {
				case 'photo':
					$popup = Popups.photoPopup();
				break;
				case 'text':
					$popup = Popups.textPopup();
				break;
				default:
					console.warn("No menus available over items of type", itemPage.item.type);
			}
			if ($popup.length != 0) {
				$popup.data("popupModel", itemId);
				$popup.data("popupPageDom", $itemDom.parents('.design-page'));
				popupOverElement($popup, $itemDom);
			}
			PB.stopEvent(ev);
		},
		makeEditable: function(item, $itemDom) {
			$itemDom.hammer().on('touch', {}, this.editItemCb);
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
	};
	PageSelection.prototype = {
		setSelection: function(itemId) {
			this.selection = itemId ? [itemId] : [];
			this.highlight();
			if (this.manipulator && this.manipulator.itemId != itemId)
				this.setManipulator(null);
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
					callback(pageSel.bookPage, itemId);
				});
			});
	};


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
