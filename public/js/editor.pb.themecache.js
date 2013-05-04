// editor.pb.themecache.js

(function(scope) {
"use strict"

var ThemeCache = {
	themes: {}, // theme_id -> {theme}, theme_id to theme map
	failed: {}, // { url -> true}. theme_id that failed to load
	loading: {}, // { url -> Deferred }, loads in progress
	get: function( id, options ) {
		if (id in this.themes)
			return this.themes[id];

		options = $.extend({
			autoload: false
		}, options);
		if (options.autoload)
			this.load( this.themeUrlFromId( id ));
		throw "No such theme " + id;
	},
	put: function(theme) {
		if ( theme.id in this.themes )
			throw new Error("theme already defined " + theme.id);
		console.log("ThemeCache+", theme.id);
		this.themes[ theme.id ] = theme;
	},
	themeUrlFromId: function(id) {
		return '/t/' + id + '/theme.js';
	},
	processLoadedTheme: function(deferred, callbackName, js, url) {

		function cleanup() {
			delete window[callbackName];
			delete ThemeCache.loading[url];
		};
		function fail(err) {
			console.error(err);
			cleanup();
			ThemeCache.failed[url] = err;
			deferred.rejectWith( url );
		};
		function success(theme) {
			ThemeCache.put( theme );
			cleanup();
			deferred.resolveWith( url, theme );
		};
		// parses the theme's javascript
		// dependencies on other themes are automatically loaded with a hack
		// hack:
		// - theme resources are loaded with function ThemeCache.resource
		// - patch ThemeCache.resource, and track all dependency calls
		// - parse our theme, and collect dependencies with the patch
		// - load all dependencies (async)
		// - when all dependencies loaded, parse the theme again

		var dependencyIds = {}; // theme_id of all dependencies
		var Noop = new function NoopF() {};
		var logger = function( resUrl ) {
			var match = ThemeCache.themeRegex.exec( resUrl );
			if (!match) {
				console.warn('bad theme dependency', resUrl);
			}
			dependencyIds[ match[1]] = true;
			return Noop;
		}

		var oldResourceFn = ThemeCache.resource;
		ThemeCache.resource = logger;
		window[ callbackName ] = $.noop;// function() { console.log('dependency parse done') };

		try {
			eval(js + "//@ sourceURL=dummy");
		}
		catch(ex) {
			ThemeCache.resource = oldResourceFn;
			var lineNo = "";
			if ( ex.lineNumber) {
				var e2 = ex.constructor();
				lineNo = " line " + (ex.lineNumber - e2.lineNumber + 7);
			}
			fail( 'theme dependency parse failed ' + ex.message  + lineNo  + ' ' + url );
			return;
		}
		ThemeCache.resource = oldResourceFn;
		// Dependency parse complete, async load all dependencies
		var dependentDeferreds = [];
		for ( var depId in dependencyIds ) {
			if (!( depId in this.themes ))
				dependentDeferreds.push(
					ThemeCache.load( ThemeCache.themeUrlFromId( depId ))
				);
		}
		$.when.apply($, dependentDeferreds)
			.done( function() {
				window[callbackName] = success;
				try {
					eval(js + "//@ sourceURL=" + url);	// calls success and sets theme
				}
				catch(ex) {
					var lineNo = "";
					if ( ex.lineNumber ) {
						var e2 = ex.constructor();
						lineNo = " line " + (ex.lineNumber - e2.lineNumber + 5);
					}
					fail('theme parse failed ' + ex.message + lineNo + ' ' + url );
				}
			})
			.fail( function() {
				fail("dependency loading failed for theme " + url)
			});
	},

	load: function(url) {
		if (url in this.loading)
			return this.loading[url];
		if( !url.length > 0)
			PB.debugthrow("bad theme url", url);

		var deferred = $.Deferred();

		if (url in this.failed) {	// do not try to reload failed resources
			deferred.rejectWith( url );
			return deferred;
		}

		this.loading[url] = deferred;

		var callbackName = "loadTheme" + PB.randomString(5);
		var jqXhr = $.ajax( {
				url: url + "?callback=" + callbackName,
				dataType: 'text',
				context: this
			})
			.done( function( response, msg, jqXHR ) {
				this.processLoadedTheme( deferred, callbackName, response, url );
			})
			.fail( function( jqXHR, status, msg ) {
				console.warn( "theme loading failed", status, msg, url );
				delete this.loading[url];
				ThemeCache.failed[url] = 'http error' + status;
				deferred.rejectWith( url );
				switch(jqXHR.status) { // offline?
					case 404:
					default:
						console.warn('template failed to load', status, msg);
						break;
				}
			});
		return deferred;
	},

	themeRegex: new RegExp("^theme\:\/\/([^\/]+)/(.*)$"),
	// Resource url scheme
	// theme://theme_id/:res_type/:res_id
	resource: function(resUrl) {
		var match = this.themeRegex.exec(resUrl);
		if (!match)
			PB.debugthrow("Malformed theme resource url ", resUrl);

		var themeId = match[1],
			pathStr = match[2];
		var theme = this.themes[themeId];
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
scope.ThemeCache = ThemeCache;
})(PB);

(function(scope) {

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
		generateLayoutId: function(layoutGen, name, width, height, assetData, layoutOptions) {
			// Utility routine that generates suggested layout id
			// id is:
			// [name]-[sizeStr]-[photoStr]-[textStr]
			var DPI = 96;
			var sizeStr = Math.round( width / 96 ) + "x" + Math.round(height / 96);

			var photoStr = "";
			var layout = layoutGen.getPageLayout( assetData, width, height, layoutOptions );
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
		},
		gutter: 10,
		// dispatches based upon layout aspect
		layoutByAspect: function( assetData, width, height, layoutOptions, aspects) {
			var ratio = width / height;
			if (ratio > 1.1)
				return (aspects.wide || aspects.square)(assetData, width, height, layoutOptions);
			else if (ratio < 0.9)
				return (aspects.tall || aspects.square)(assetData, width, height, layoutOptions);
			else
				return (aspects.square || aspects.wide)(assetData, width, height, layoutOptions);
		}
	};

	scope.ThemeUtils = ThemeUtils;
})(PB);
