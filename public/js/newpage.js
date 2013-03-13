"use strict"

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

// AbstractLayout documents minimal layout class looks like. not functional
var AbstractLayout = {
	id: '',
	// assetData from book-page, read-only
	// page width/height
	// options are layout-dependent (ex inset....)
	getPageDesign: function(assetData, width, height, layoutData) {
		return {
			layout: [ {
				type: 'photo',
				top: 0,
				left: 0,
				width: 0,
				height: 0,
				frameId: '', // optional
				frameOffset: [0,0,0,0], // TRBL, optional
				frameData: {} // frameId specific
			}],
			background: {
				id: '',
				data: {
					// background-specific data
				}
			}
		}
	}
};

var PhotoCache = {
	cache: {},
	put: function(photo) {
		this.cache[photo.id] = photo;
	},
	get: function(id) {
		if (id in this.cache)
			return this.cache[id];
		throw "No such photo" + id;
	}
};

var PlaceholderPhoto = function(id, url, width, height) {
	this.id = id;
	this.url = url;
	this.width = width;
	this.height = height;
}

var PhotoPlaceholder = {
	init: function() {
		PhotoCache.put(new PlaceholderPhoto('h1', '/img/h1.png', 723, 541));
		PhotoCache.put(new PlaceholderPhoto('h2', '/img/h2.png', 717, 538));
		PhotoCache.put(new PlaceholderPhoto('h3', '/img/h3.png', 751, 561));
		PhotoCache.put(new PlaceholderPhoto('h4', '/img/h4.png', 718, 538));
		PhotoCache.put(new PlaceholderPhoto('h5', '/img/h5.png', 710, 533));
		PhotoCache.put(new PlaceholderPhoto('h6', '/img/h6.png', 719, 534));
		PhotoCache.put(new PlaceholderPhoto('v1', '/img/v1.png', 785, 1127));
		PhotoCache.put(new PlaceholderPhoto('v2', '/img/v2.png', 483, 646));
		PhotoCache.put(new PlaceholderPhoto('v3', '/img/v3.png', 484, 650));
		PhotoCache.put(new PlaceholderPhoto('v4', '/img/v4.png', 482, 644));
	},
	vphotos: ['v1', 'v2', 'v3', 'v4'],
	hphotos: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
	randomH: function(guess) {
		var index;
		if ((typeof guess) === 'number')
			index = Math.floor(guess % this.hphotos.length);
		else
			index =  Math.floor( Math.random() * this.hphotos.length );
		return PhotoCache.get( this.hphotos[index] );
	},
	randomV: function(guess) {
		var index;
		if ((typeof guess) === 'number')
			index = Math.floor(guess % this.vphotos.length);
		else
			index =  Math.floor( Math.random()* this.vphotos.length );
		return PhotoCache.get( this.vphotos[ index] );
	},
	random: function(guess) {
		if ((typeof guess) === 'number')
			return (Math.floor(guess % 2) == 0) ?
				this.randomH(guess) : this.randomV(guess);
		else
			return  (Math.random() > 0.5) ?
				this.randomH(guess) : this.randomV(guess);
	}
};
PhotoPlaceholder.init();

var ThemeCache = {
	cache: {},
	get: function(id) {
		if (id in this.cache)
			return this.cache[id];
		throw "No such theme " + id;
	},
	put: function(theme) {
		if (theme.id in this.cache)
			throw "theme already defined " + theme.id;
		this.cache[theme.id] = theme;
	},
	themeRegex: new RegExp("^theme\:\/\/([^\/]+)/(.*)$"),
	// Resource url scheme
	// theme://theme_id/:res_type/:res_id
	resource: function(resUrl) {
		var match = this.themeRegex.exec(resUrl);
		if (!match) {
			var err = "Malformed theme resource url " + resUrl; console.error(err); throw err;
		}
		var themeId = match[1],
			pathStr = match[2];
		var theme = this.cache[themeId];
		if (!theme) {
			var err = "Theme not found " + resUrl; console.error(err); throw err;
		}
		var p,
			res = theme,
			path = pathStr.split('/');
		while (p = path.shift()) {
			res =  res[p];
			if (res === undefined) {
				var err = "Resource not found  " + resUrl + " problem: " + p; console.error(err); throw err;
			}
		}
		return res;
	}
};

// Base Theme 'theme://base/'
(function(themeCache) {
	var Utils = {
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
		assetGenericCount: function(assetData, type) {
			var c = 0;
			for (var p in assetData)
				if (assetData[p].type === type)
					c++;
			return c;
		},
		assetPhotoCount: function(assetData) {
			return this.assetGenericCount(assetData, 'photo');
		},
		assetTextCount: function(assetData) {
			return this.assetGenericCount(assetData, 'text');
		}
	};

	var GridLayout = {
		id: 'gridLayout',
		getPageDesign: function(assetData, width, height, layoutData) {
			layoutData = $.extend({inset: 0}, layoutData);
			width = Math.max(width - 2 * layoutData.inset, 0);
			height = Math.max(height - 2 * layoutData.inset, 0);
			if (!width || width < 50 || !height || height < 50) {
				console.error('getPageDesign width/height too small', width, height);
				return;
			}
			// Generate optimum tiles
			var photoCount = Utils.assetPhotoCount(assetData);
			var textCount = Utils.assetTextCount(assetData);
			var totalCount = photoCount + textCount;
			var tileCountH = Math.round(Math.sqrt(totalCount * width / height));
			var tileCountV = Math.ceil(totalCount / tileCountH);
			var widthSegments = Utils.segmentLine(width, tileCountH);
			var heightSegments = Utils.segmentLine(height, tileCountV);
			var layout = [];
			for (var v=0; v < tileCountV; v++) {
				for (var h=0; h < tileCountH; h++) {
					var imgIdx = v * tileCountH + h;
					if (imgIdx >= totalCount)
						break;
					var assetData = {
						top: layoutData.inset + heightSegments[v],// v * tileHeight,
						left: layoutData.inset + widthSegments[h], //h * tileWidth,
						height: heightSegments[v+1] - heightSegments[v], //tileHeight
						width: widthSegments[h+1] - widthSegments[h] //tileWidth,
					}
					if (imgIdx < photoCount) {
						assetData.type = 'photo';
						layout.push(assetData);
					}
					else {
						assetData.type = 'text';
						layout.push(assetData);
					}
				}
			}
			return {
				layout: layout
			}
		}
	};

	var GridSpacedLayout = {
		id: 'GridSpacedLayout',
		getPageDesign: function(assetData, width, height, layoutData) {
			layoutData = $.extend({
				spaceOffset: 0
			}, layoutData);
			var design = GridLayout.getPageDesign(assetData, width, height, $.extend({ inset: layoutData.spaceOffset}, layoutData));
			var layout = design.layout;
			for (var i=0; i < layout.length; i++) {
				layout[i].top += layoutData.spaceOffset;
				layout[i].left += layoutData.spaceOffset;
				layout[i].width -= layoutData.spaceOffset * 2;
				layout[i].height -= layoutData.spaceOffset * 2;
			}
			return design;
		},
	};

	var CssBackground = {
		id: 'cssBackground',
		sampleOption: {
			css: {
				backgroundColor: 'transparent',
				backgroundPosition : '0% 0%',
				backgroundSize: 'auto auto',
				backgroundRepeat: 'repeat',
				backgroundClip: 'border-box',
				backgroundImage: '$IMG'	// Image URLs are substituted with appropriate resolution
			},
			imageSubstitution: {
				$IMG: {
					small: '',
					display: '',
					original: ''
				}
			}
		},

		fillBackground: function( $div, backgroundData, options) {
			backgroundData = $.extend({
				css: { // from http://lea.verou.me/css3patterns/#weave
					background: 'linear-gradient(135deg, #708090 22px, #d9ecff 22px, #d9ecff 24px, transparent 24px, transparent 67px, #d9ecff 67px, #d9ecff 69px, transparent 69px), linear-gradient(225deg, #708090 22px, #d9ecff 22px, #d9ecff 24px, transparent 24px, transparent 67px, #d9ecff 67px, #d9ecff 69px, transparent 69px) 0 64px',
					backgroundColor: '#708090',
					backgroundSize: '64px 128px'
				}
			}, backgroundData);
			if (backgroundData.css.backgroundImage) {
				var defaultSize = 'original';
				var match = backgroundData.css.backgroundImage.match(/(\$[\w]+)/g);
				for (var i=0; i<match.length; i++) {
					if (match[i] in backgroundData.imageSubstitution) {
						debugger;	// need url substitution here
						backgroundData.css.backgroundImage = backgroundData.css.backgroundImage.replace(match[i], backgroundData.imageSubstitution[p][defaultSize]);
					}
					else {
						console.error("unable to substitute css image " + match[i]);
						debugger;
					}
				}
			}
			$div.css(backgroundData.css);
		}
	};

	var CssFrame = {
		id: 'cssFrame',
		fillFrame: function($div, frameOffset, frameData, options) {
			frameData = $.extend({
				css: {
					backgroundColor: 'green',
					boxShadow: '5px 5px 5px rgba(0,0,0,0.3)'
				}
			}, frameData);
			$div.css(frameData.css);
		}
	};

	var BaseTheme = {
		id: 'base',
		layouts: {
			gridLayout : GridLayout,
			gridSpacedLayout : GridSpacedLayout
		},
		backgrounds: {
			cssBackground: CssBackground
		},
		frames: {
			cssFrame: CssFrame
		},
		utilities: Utils
	 };
	 themeCache.put(BaseTheme)
})(ThemeCache);

// ExperimentalTheme
(function(themeCache) {
	var FramedLayout = {
		id: 'framedLayout',

		getPageDesign: function(assetData, width, height, options) {
			options = $.extend({
				frameWidth: 10,	// syntax same as border-image-width https://developer.mozilla.org/en-US/docs/CSS/border-image-width
				spaceOffset: 10
			}, options);
			var Utils = ThemeCache.resource('theme://base/utilities');
			var design = ThemeCache.resource('theme://base/layouts/gridSpacedLayout').getPageDesign(assetData, width, height, options );
			var layout = design.layout;
			var rotate = 5;
			var frameOffset = Utils.canonicalFrameWidth(options.frameWidth);
			for (var i=0; i < layout.length; i++) {
				layout[i].rotate = rotate;
				rotate += 10;
				layout[i].frameId = 'theme://base/frames/cssFrame';
				layout[i].frameOffset = frameOffset;
				layout[i].frameData = { backgroundColor: 'red'}
			}
			return design;
		}
	};

	var ExperimentalTheme = {
		id: 'experimental',
		layouts: {
			framedLayout: FramedLayout
		}
	};
	themeCache.put(ExperimentalTheme);
})(ThemeCache);

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

var BookPage = function(book, bookPage) {
	this.book = book;
	this.data = bookPage;
};

BookPage.prototype = {
	get p() {
		return this.data;
	},
	get width() {
		return this.p.width;
	},
	get height() {
		return this.p.height;
	},
	addAsset: function(id, assetData) {
		this.p.assets.push(id);
		this.p.assetData[id] = assetData;
		this.p.hasLayout = false;
	},
	addPhoto: function(id) {
		var data = {
			type: 'photo',
			photoId: id
		};
		this.addAsset(PB.randomString(6), data);
	},
	addText: function(content) {
		this.addAsset(PB.randomString(6), {
			type: 'text',
			content: content
		});
	},
	setLayout: function(layoutId, layoutData) {
		this.p.layoutId = layoutId;
		this.p.layoutData = layoutData;
		this.hasLayout = false;
	},
	setBackground: function(backgroundId, backgroundData) {
		this.p.backgroundId = backgroundId;
		this.p.backgroundData = backgroundData;
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
					var loadDef = LoadImageDeferred(PhotoPlaceholder.random(i).url);
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
//						context.strokeStyle = 'black';
//						context.strokeRect(r.left, r.top, r.width, r.height);
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
						console.error("Should add more photos dynamically");
						break;
					}
					var assetData = this.p.assetData[photoId];
					var innerRect = new GUI.Rect({width: dd.width, height: dd.height});
					if(dd.frameId)
						innerRect = innerRect.inset(dd.frameOffset);

					var photo = PhotoCache.get(assetData.photoId);
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
					console.error("do not know how to handle assets", dd.type);
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
			.prop('src', PhotoCache.get( asset.photoId).url )
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
			.design-photo
			.design-text
	*/
	generateDom: function(options) {
		options = $.extend({
			syncable: false,	//
			editable: false
		}, options);
		var encloseDom = this.enclosingDom( options );
		if (this.p.hasLayout)
		{	// layout all parts of the page
			var p = this.p;
			if (p.backgroundId) {
				ThemeCache.resource( p.backgroundId ).fillBackground( encloseDom, p.backgroundData, options );
			}
			for (var i=0; i < p.assets.length; i++) {
				var item = p.assetData[p.assets[i]];
				var itemDom;
				switch(item.type) {
					case 'photo':
						itemDom = this.generatePhotoDom( item, options );
						break;
					case 'text':
						itemDom = this.generateTextDom( item, options );
						break;
					default:
						debugger;
				}
				if (item.rotate) {
					itemDom.css('transform', 'rotate(' + item.rotate + 'deg)');
				}
				encloseDom.append( itemDom );
				if (options.editable) {
					itemDom.data('model_id', p.assets[i]);
					this.makeEditable(item, itemDom);
				};
			}
		}
		else
			encloseDom.text("Design not available." + this.p.assets.length + " items on this page");
		if (options.editable) {
			var ps = new PageSelection(this, encloseDom);
		}
		return encloseDom;
	}
}

var BookPageEditable = {
	touchItemCb: function(ev) {
		var itemDom = $(ev.currentTarget);
		var itemId = itemDom.data('model_id');
		PageSelection.findInParent(itemDom)
			.setSelection(itemId);
		console.log("item was clicked");
	},
	makeEditable: function(item, $itemDom) {
		$itemDom.hammer().on('touch', {}, this.touchItemCb);
	}
};

$.extend(BookPage.prototype, BookPageEditable);

var PageSelection = function(bookPage, dom) {
	this.bookPage = bookPage;
	this.dom = dom;
	dom.data(PageSelection.DATA_ID, this);
	this.selection = [];
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
PageSelection.prototype = {
	setSelection: function(itemId) {
		this.selection = [itemId];
		this.dom.find('.selected').removeClass('selected');
		this.dom.find('*:data("model_id=' + itemId + '")').addClass('selected');
	}
};
