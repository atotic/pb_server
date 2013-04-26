"use strict"


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


var ThemeCache = {
	cache: {},
	get: function( id, url ) {
		if (id in this.cache)
			return this.cache[id];
		if (url)
			this.load(url);
		throw "No such theme " + id;
	},
	put: function(theme) {
		if (theme.id in this.cache)
			throw "theme already defined " + theme.id;
		this.cache[theme.id] = theme;
	},
	load: function(url) {
		var jqXhr = $.ajax( {
				url: url,
				dataType: 'jsonp'
			})
			.done( function( response, msg, jqXHR ) {
				console.log('theme loaded');
				ThemeCache.put( response );
			})
			.fail( function( jqXHR, status, msg ) {
				console.warn("theme loading failed", status, msg, url);
				switch(jqXHR.status) {
					case 404:
					default:
						console.warn('template failed to load', status, msg);
						break;
				}
			});
		return jqXhr;
	},

	themeRegex: new RegExp("^theme\:\/\/([^\/]+)/(.*)$"),
	// Resource url scheme
	// theme://theme_id/:res_type/:res_id
	resource: function(resUrl) {
		var match = this.themeRegex.exec(resUrl);
		if (!match) {
			var err = "Malformed theme resource url " + resUrl; console.error(err); throw new Error(err);
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

	var PhotoWidget = function(options) {
		this.options = $.extend( {
			url: 'data:image/svg+xml;utf8,<?xml version="1.0" ?><svg xmlns="http://www.w3.org/2000/svg" height="100px" width="100px" version="1.1" y="0px" x="0px" overflow="visible" viewBox="0 0 100 100" ><rect width="100" height="100" fill="#F6EC43"/><text font-size="14"  transform="matrix(1 0 0 1 25 40)">Photo</text><text font-size="14" transform="matrix(1 0 0 1 25 60)">Widget</text></svg>',
			defaultWidth: 100,
			defaultHeight: 100
		}, options);
	};
	PhotoWidget.prototype = {
		defaultWidth: function( widgetOptions ) {
			return widgetOptions.defaultWidth || this.options.defaultWidth;
		},
		defaultHeight: function( widgetOptions ) {
			return widgetOptions.defaultHeight || this.options.defaultHeight;
		},
		generateDom: function(width, height, widgetOptions, displayOptions) {
			widgetOptions = $.extend({}, this.options, widgetOptions);
			var dom = $('<img>')
				.prop('src', widgetOptions.url);
			return dom;
		}
	}


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
		widgets: {
			photoWidget: new PhotoWidget()
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
				rotate += 25;
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

// ThemeCache.resource('theme://sample1/designs/')
// ThemeCache.resource('theme://sample1//')
(function(themeCache) {


	var SampleTheme = {
		id: 'sample1',
		title: 'Sample Theme',
		description: "Long description",
		screenshots: ['/t/_test/family/showcase1.jpg'],
		designs: {
		},
		layouts: {
		},
		backgrounds: {
		},
		frames: {
		},
		widgets: {
			soccerBall: {},
			eightBall: {

			}
		},
		sized: {
			s8x8: {
				sizes: {width: 8, height: 8 }
			}
		}
	}

	themeCache.put(SampleTheme);
})(ThemeCache);




