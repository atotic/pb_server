// editor.pb.themeutils.js
// ThemeUtils
(function(scope) {
"use strict"

	var DesignIconBuilder = function( page, maxHeight, options ) {
		this.page = page;
		this.maxHeight = maxHeight;
		this.options = $.extend( {}, {
				designId: null,
				layoutId: null,
				layoutData: null,
				layoutOnly: false,
				useFillerPhotos: false
			}, options );;
	};

	var FRAME_FILL = '#888';
	var ERROR_FILL = 'red';

	// DesignIconBuilder creates icons for designs and layouts
	// Icons are <canvas>
	// Most of the icon is created with drawImage. Deferreds are used
	// to schedule drawing after images are loaded
	DesignIconBuilder.prototype = {
		create: function() {

			// Compute icon dimensions
			var enclosure = new GUI.Rect( { width: this.maxHeight * 4 / 3, height: this.maxHeight });
			this.pageRect = new GUI.Rect( this.page.dimensions );
			this.scale = this.pageRect.fitInside( enclosure );
			this.pageRect = this.pageRect.scaleBy( this.scale ).round();

			// Create canvas
			this.canvas = document.createElement('canvas');
			this.canvas.width = this.pageRect.width;
			this.canvas.height = this.pageRect.height;
			this.context = this.canvas.getContext('2d');

			// Get layout
			var layout;
			var mockPage = this.getMockPage();
			if ( this.options.layoutId) {
				layout = PB.ThemeCache.resource( this.options.layoutId )
					.getPageLayout(mockPage, this.options.layoutData);
			}
			else {
				var designRes = PB.ThemeCache.resource( this.options.designId );
				layout = designRes.getPageLayout( mockPage );
			}
			// Draw background
			var drawOp = this.addDrawingOperation(null, this.initBackground, this.drawBackground);
			// Draw images
			var assets = mockPage.getAssets();
			for (var i=0; i<assets.ids.length; i++) {
				var asset = assets[ assets.ids[i]];
				switch( asset.type) {
					case 'photo':
						$.extend( asset, layout.photos.shift() );
						drawOp = this.addDrawingOperation( drawOp, this.initPhoto, this.drawAsset, asset);
					break;
					case 'text':
						if (layout.texts.length > 0) {
							$.extend( asset, layout.texts.shift() );
							drawOp = this.addDrawingOperation( drawOp, this.initText, this.drawAsset, asset);
						}
					break;
					case 'widget':
					if (layout.widgets.length > 0) {
						$.extend( asset, layout.widgets.shift());
						drawOp = this.addDrawingOperation( drawOp, this.initWidget, this.drawAsset, asset);
					}
					break;
				}
			}
			return this.canvas;
		},

		getMockPage: function() {
			var assets = this.page.getAssets();
			var newAssets = { ids: [] };
			for (var i=0; i< assets.ids.length; i++) {
				var id = assets.ids[i];
				switch(assets[id].type) {
					case 'photo':
						newAssets.ids.push( id );
						newAssets[id] = {
							type: 'photo',
							photoId: assets[id].photoId
						}
					break;
					case 'text':
						newAssets.ids.push( id );
						newAssets[id] = {
							type: 'text'
						}
					break;
					default:
					break;
				}
			}
			if ( ! ( this.options.layoutOnly || this.options.layoutId )) {
				var THIS = this;
				PB.ThemeCache.resource( this.options.designId )
					.getWidgets( this.page )
					.forEach( function(w) {
						var assetData = {
							type: 'widget',
							widgetId: w.id,
							widgetOptions: w.options,
							widgetCreator: THIS.options.designId
						};
						var id = PB.randomString(6);
						newAssets.ids.push(id);
						newAssets[id] = assetData;
					});
			}
			return PB.ThemeUtils.layoutMockupPage( newAssets, this.page.dimensions );
		},
		addDrawingOperation: function(previousDef, initFn, drawFn, fnArgs) {
			var THIS = this;
			var drawingOpDef = $.Deferred();
			var initDef = $.Deferred();
			try {
				initFn.apply(this, [initDef, fnArgs]);
			}
			catch(ex) {
				console.error(ex);
			}
			var waitFor = previousDef ? [previousDef, initDef] : [initDef];
			$.when.apply($, waitFor).always( function() {
				try {
					drawFn.apply(THIS, [fnArgs]);
				}
				catch(ex) {
					console.error(ex);
				}
				drawingOpDef.resolve();
			});
			return drawingOpDef;
		},

		initBackground: function(defOp, fnArgs) {
			defOp.resolve();
		},
		drawBackground: function(fnArgs) {
			if ( !this.options.designId || this.options.layoutOnly ) {
				this.context.fillStyle = '#AAA';
				this.context.fillRect(0,0, this.pageRect.width, this.pageRect.height);
				this.context.strokeStyle = '#CCC';
				this.context.lineWidth = 1;
				this.context.strokeRect(0, 0, this.pageRect.width, this.pageRect.height);
			}
			else {
				var backgroundId = PB.ThemeCache.resource( this.options.designId ).getBackgroundId();
				var backgroundRes = PB.ThemeCache.resource( backgroundId );
				backgroundRes.fillBackground($( this.canvas), null, {resolution: PB.PhotoProxy.ICON });
			}
		},
		initPhoto: function( defOp, assetData) {
			// load the photo here
			var url = PB.ServerPhotoCache.get( assetData.photoId).getUrl( PB.PhotoProxy.ICON );
			var img = new Image();
			img.onload = function() {
				assetData.image = img;
				defOp.resolve();
			};
			img.onerror = function(a,b,c) {
				console.error('icon image loading failed', src);
				defOp.resolve();
			};
			img.src = url;
		},
		initText: function( defOp, assetData) {
			if ('textPattern' in this)	// use textPattern as flag
				defOp.resolve();
			else {
				var THIS = this;
				this.textPattern = null;
				var img = new Image();
				img.onload = function() {
					img.width = 10;
					img.height = 10;
					THIS.textPattern = THIS.context.createPattern(img, 'repeat');
					defOp.resolve();
				};
				img.onerror =function() {
					console.error('could not load text pattern');
					defOp.resolve();
				}
				img.src = '/img/abstract-text-pattern.jpg';
			}
		},
		initWidget: function( defOp, asset) {
			var widget = PB.ThemeCache.resource(asset.widgetId);
			var $dom = widget.generateDom( asset.width, asset.height, asset.widgetOptions,
				{resolution: PB.PhotoProxy.ICON });
			// widget icon is first img generated by widget
			var $img = $dom.prop('nodeName') == 'IMG' ? $dom : $dom.find('img');
			if ($img.length > 0) {
				var url = $img.attr('src');
				var img = new Image();
				img.onload = function() {
					asset.image = img;
					defOp.resolve();
				};
				img.onerror = function() {
					console.error('error loading widget icon', asset.widgetId, url);
					defOp.resolve();
				};
				img.src = url;
			}
			else
				defOp.resolve();
		},
		drawAsset: function( asset ) {
//			console.log('drawAsset', this.options, asset);
			var r = new GUI.Rect( asset );
			r = r.scaleBy( this.scale, true ).round();
			var rotatedContext = new GUI.Rotated2DContext( this.context, asset.rotate * Math.PI / 180 );
			var THIS = this;
			if ( asset.frameId && $.isArray( asset.frameOffset)) {
				// Draw frame
				var frameOffset = asset.frameOffset.map(function(v) { return v * THIS.scale; });
				this.context.strokeStyle = FRAME_FILL;
				rotatedContext.strokeRect(r.left, r.top, r.width, r.height);
				this.context.moveTo(r.left, r.top);
				this.context.lineWidth = frameOffset[0];
				this.context.lineTo(r.right, r.top);
				this.context.lineWidth = frameOffset[1];
				this.context.lineTo(r.right, r.bottom);
				this.context.lineWidth = frameOffset[2];
				this.context.lineTo(r.left, r.bottom);
				this.context.lineWidth = frameOffset[3];
				this.context.lineTo(r.left, r.top);
				r = r.inset(frameOffset);
			};
			switch( asset.type) {
				case 'photo':
				case 'widget':
					if (asset.image) {
						try {
							rotatedContext.drawImage( asset.image, r.left, r.top, r.width, r.height);
						}
						catch(ex) {
							console.error(ex.message);
							debugger;
						}
					}
					else {
						this.context.fillStyle = ERROR_FILL;
						rotatedContext.fillRect(r.left, r.top, r.width, r.height);
						rotatedContext.strokeRect(r.left, r.top, r.width, r.height);
					};
				break;
				case 'text':
					if (this.textPattern)
						this.context.fillStyle = this.textPattern;
					else
						this.context.fillStyle = 'yellow';
					rotatedContext.fillRect(r.left, r.top, r.width, r.height);
				break;
				default:
					console.error("unknown asset type");
			}
		}
	}

	var ThemeUtils = {
		// frameWidth can be undefined, number, or [number]
		canonicalFrameWidth: function(frameWidth) {
			if (frameWidth === undefined)
				return 0;
			if (typeof frameWidth == 'number')
				return [frameWidth, frameWidth, frameWidth, frameWidth];
			switch(frameWidth.length) {
				case 1:
					return [frameWidth[0], frameWidth[0], frameWidth[0], frameWidth[0]];
					break;
				case 2:
					return [frameWidth[0], frameWidth[1], frameWidth[0], frameWidth[1]];
					break;
				case 3:
					return [frameWidth[0], frameWidth[1], frameWidth[2], frameWidth[1]];
					break;
				case 4:
					return frameWidth;
					break;
				default:
					console.error('illegal frame width ', frameWidth);
					return [0,0,0,0];
			}
		},
		// line gets divided into segmentCount,
		// segments are forced to integer length
		// return: [segmentCount + 1] of segment terminating points
		segmentLine: function(line, segmentCount) {
			if (isNaN(segmentCount) || segmentCount == 0)
				return [];
			var rem = line % segmentCount;
			var segLength = Math.round((line - rem) / segmentCount);
			var segments = new Array(segmentCount + 1);
			segments[0] = 0;
			for (var i=1; i<= segmentCount; i++) {
				var padding = 0;
				if (rem > 0) { // pad each segment by 1 until no more extra pixels
					padding += 1;
					rem -=1;
				}
				segments[i] = segments[i-1] + segLength + padding;
			}
			return segments;
		},
		generateLayoutId: function(layoutGen, name, page, layoutOptions) {
			// Utility routine that generates suggested layout id
			// id is:
			// [name]-[sizeStr]-[photoStr]-[textStr]
			var DPI = 96;
			var d = page.dimensions;
			var sizeStr = Math.round( d.width / 96 ) + "x" + Math.round(d.height / 96);

			var photoStr = "";
			var layout = layoutGen.getPageLayout( page, layoutOptions );
			if (layout.photos.length > 6) {
				photoStr = "photo" + layout.photos.length;
			}
			else {
				for (var i=0; i<layout.photos.length; i++) {
					var smallDim = 2 * DPI;
					var ratio = layout.photos[i].width / layout.photos[i].height;
					var imgStr = ratio > 1.1 ? 'H' : ratio < 0.9 ? 'V' : 'S';
					if ( Math.min( layout.photos[i].width, layout.photos[i].height ) < smallDim )
						imgStr = imgStr.toLowerCase();
					 photoStr += imgStr;
				}
			}
			var textStr = "";
			if (layout.texts.length > 0)
				for (var i=0; i<layout.texts.length; i++)
				{
					if (i == 0) textStr += '_';
					textStr += "T";
				}
			return name + "_" + sizeStr + "_" + photoStr + textStr;
		},
		// Creates icon for design or layout as canvas
		getDesignIcon: function( page, maxHeight, options) {
			var builder = new DesignIconBuilder( currentPage, maxHeight, options);
			return builder.create();
		},
		assetGenericCount: function(assets, type) {
			var c = 0;
			for (var p in assets)
				if (assets[p].type === type)
					c++;
			return c;
		},
		assetPhotoCount: function(assets) {
			return this.assetGenericCount(assets, 'photo');
		},
		assetTextCount: function(assets) {
			return this.assetGenericCount(assets, 'text');
		},
		assetWidgetIdByCreator: function(assets, creator) {
			var retVal = [];
			for (var i=0; i<assets.ids.length; i++) {
				var asset = assets[ assets.ids[i]];
				if (asset.type == 'widget' && asset.widgetCreator == creator)
					retVal.push(assets.ids[i]);
			}
			return retVal;
		},
		// Create fake page for getPageLayout
		layoutMockupPage: function(assets, dimensions) {
			if (! assets.ids) {	// mock the id list
				var ids = [];
				for (var p in assets)
					ids.push(p);
				assets.ids = ids;
			};
			return {
				dimensions: dimensions,
				getAssets: function() {
					return assets;
				}
			}
		},
		gutter: 10,
		// dispatches based upon layout aspect
		layoutByAspect: function( page, layoutOptions, aspects) {
			var d = page.dimensions;
			var ratio = d.width / d.height;
			if (ratio > 1.1)
				return (aspects.wide || aspects.square)(page, layoutOptions);
			else if (ratio < 0.9)
				return (aspects.tall || aspects.square)(page, layoutOptions);
			else
				return (aspects.square || aspects.wide)(page, layoutOptions);
		}
	};

	scope.ThemeUtils = ThemeUtils;
})(PB);
