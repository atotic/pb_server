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
			eval(js);
		}
		catch(ex) {
			ThemeCache.resource = oldResourceFn;
			fail( 'theme dependency parse failed ' + ex.message + ' ' + url );
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
					eval(js);	// calls success and sets theme
				}
				catch(ex) {
					fail('theme parse failed ' + ex.message + ' ' + url );
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

// ExperimentalTheme
(function(themeCache) {
	var FramedLayout = {
		id: 'framedLayout',

		getPageDesign: function(assetData, width, height, options) {
			options = $.extend({
				frameWidth: 10,	// syntax same as border-image-width https://developer.mozilla.org/en-US/docs/CSS/border-image-width
				spaceOffset: 10
			}, options);
			var Utils = ThemeCache.resource('theme://admin@base/utilities');
			var design = ThemeCache.resource('theme://admin@base/layouts/gridSpacedLayout').getPageDesign(assetData, width, height, options );
			var layout = design.layout;
			var rotate = 5;
			var frameOffset = Utils.canonicalFrameWidth(options.frameWidth);
			for (var i=0; i < layout.length; i++) {
				layout[i].rotate = rotate;
				rotate += 25;
				layout[i].frameId = 'theme://admin@base/frames/cssFrame';
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
