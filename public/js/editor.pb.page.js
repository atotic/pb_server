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
	frameOffset { trbl }
}
asset photo {
	type: 'photo'
	photoId
	photoRect { tlwh }
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
		PB.ModelMap.setResolver( function() {
			var page = book.page(pageProxy.id);
			var item = page.p.assetData[assetId];
			if (!item)
				PB.debugstr("Resolving item not there");
			return item;
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
		// return: [assetData*]
		getAssetData: function(itemType) {
			var ids = this.getAssetIds(itemType);
			var retVal = [];
			for (var i=0; i<ids.length; i++)
				retVal.push(this.p.assetData[ids[i]]);
			return retVal;
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
			options = $.extend({
				clobber: false	// clobbers all existing data
			}, options);
			if (!(id in this.p.assetData))
				return PB.debugstr("Updating non-existent asset data");
			if (options.clobber)
				this.p.assetData[id] = newData;
			else
				$.extend(this.p.assetData[id], newData);
			this.updateItemInner(id);
			PB.broadcastChange({id: id}, 'alldata', options);
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

			// Load all images as deferred
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
		updateItemInner: function(itemId) {
			if ( !this.p.hasLayout )
				return;
			if ( !( itemId in this.p.assetData ))
				return PB.debugstr("updateItemInner on non-existent item");

			var assetData = this.p.assetData[itemId];
			switch(assetData.type) {
				case 'photo':
					var innerRect = new GUI.Rect(assetData);
					if (assetData.frameId)
						innerRect = innerRect.inset(assetData.frameOffset);

					var photo = PB.ServerPhotoCache.get(assetData.photoId);
					var photoRect = new GUI.Rect(photo);
					var scale = photoRect.fillInside(innerRect);
					photoRect = photoRect.scaleBy(scale).centerIn(innerRect).round();
					$.extend(assetData.photoRect, {
						top: photoRect.top,
						left: photoRect.left,
						width: photoRect.width,
						height: photoRect.height
					});
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

				var assetData;
				switch(dd.type) {
					case 'photo': {
						var photoId = photoAssetIds.shift();
						if (photoId == null) {
							PB.debugstr("Should add more photos dynamically");
							break;
						}
						var assetData = this.p.assetData[photoId];
						var innerRect = new GUI.Rect({width: dd.width, height: dd.height});
						if (dd.frameId)
							innerRect = innerRect.inset(dd.frameOffset);

						var photo = PB.ServerPhotoCache.get(assetData.photoId);
						var photoRect = new GUI.Rect(photo);
						var scale = photoRect.fillInside(innerRect);
						photoRect = photoRect.scaleBy(scale).centerIn(innerRect).round();
						$.extend(assetData,{
							top: dd.top,
							left: dd.left,
							width: dd.width,
							height: dd.height,
							rotate: dd.rotate || 0,
							photoRect: {
								top: photoRect.top,
								left: photoRect.left,
								width: photoRect.width,
								height: photoRect.height
							}
						});
					}
					break;
					case 'text': {
						var textId = textAssetIds.shift();
						if (textId == null) {
							console.error("Should add more text dynamically");
							break;
						}
						var assetData = this.p.assetData[textId];
						$.extend(assetData, {
							top: dd.top,
							left: dd.left,
							width: dd.width,
							height: dd.height,
							rotate: dd.rotate || 0
						});
					}
					break;
					default: {
						console.error("do not know how to handle assets of type", dd.type);
					}
				}
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
		/* textDom
			div.design-text tlwh
				div.design-text-content
		*/
		generateTextDom: function(asset, options) {
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
			var t = 'Your text here';
			if (((typeof asset.content) == 'string') && asset.content != '')
				t = asset.content;
			var textContent = $(document.createElement('div'))
				.addClass('design-text-content')
				.css({
					top:innerFrame.top,
					left: innerFrame.left,
					width: innerFrame.width,
					height: innerFrame.height
				})
				.text(t);
			designText.append(textContent);
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
			if ( options.editable )
				PageSelection.bindToDom( this, $encloseDom )
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

	var PageProxyEditable = {
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
			popupOverElement($('#photo-popup'), $itemDom);
			var srcEvent = ev.gesture.srcEvent;
//			srcEvent.preventDefault();
//			srcEvent.stopPropagation();
		},
		makeEditable: function(item, $itemDom) {
//			$itemDom.on('click', this.editItemCb);
			$itemDom.hammer().on('touch', {}, this.editItemCb);
		},
		makeItemSyncable: function(page, $itemDom, options) {
			$itemDom.on( PB.MODEL_CHANGED, function( ev, model, prop, eventOptions ) {
				$itemDom.remove();
				page.generateDom($.extend( {}, eventOptions, options));
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
	};
	PageSelection.prototype = {
		setSelection: function(itemId) {
			this.selection = itemId ? [itemId] : [];
			this.highlight();
		},
		highlight: function() {
			this.dom.find('.selected').removeClass('selected');
			for (var i=0; i<this.selection.length; i++)
				this.dom.find('*:data("model_id=' + this.selection[i] + '")').addClass('selected');
		}
	};


	PageSelection.DATA_ID = 'pageSelection';
	PageSelection.findInParent = function($dom) {
		var ps = $dom.parents('*:data("pageSelection")').data(PageSelection.DATA_ID);
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

	$(document).ready(function() {
		// create the action popups
		function makeLiAction($li, title) {
			var $a = $(document.createElement('a'));
			$a.text(title);
			$a.prop('href', '/#' + title);
			$a.on("click", function(ev) {
				console.log(title);
				ev.preventDefault();
			});
			$li.append($a);
		}
		var $photoPopup = $('<ul>')
			.addClass('pb-popup-menu')
			.prop('id', 'photo-popup');
		["pan","move","zoom","resize","rotate","clear"]
			.forEach( function( title ) {
				var $li = $( "<li>" );
				makeLiAction($li, title);
				$photoPopup.append($li);
			});
		$(document.body).append($photoPopup);
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
