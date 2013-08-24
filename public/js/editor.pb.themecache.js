// editor.pb.themecache.js
/*
ThemeCache loads and caches themes

Usage:

Theme.get - gets cached theme. Loads theme if not in cache by default
Theme.resource - gets theme resource from theme url. Autoloads the theme if missing
*/
(function(scope) {
"use strict"

var ThemeNotFoundException = function(msg, deferred) {
	var e = new Error(msg);
	e.name = "ThemeNotFoundException";
	e.deferred = deferred;
	return e;
};

var ThemeCache = {
	themes: {}, // theme_id -> {theme}, theme_id to theme map
	failed: {}, // { url -> true}. theme_id that failed to load
	loading: {}, // { url -> Deferred }, loads in progress
	get: function( id, options ) {
		if (id in this.themes)
			return this.themes[id];
		options = $.extend({
			autoload: true
		}, options);
		var deferred = null;
		var err = new Error("No such theme " + id);
		if (options.autoload) {
			err.deferred = this.load( this.themeUrlFromId( id ));
		}
		err.name = "NoSuchTheme";
		throw err;
	},
	put: function(theme) {
		if ( theme.id in this.themes )
			throw new Error("theme already defined " + theme.id);
		// console.log("ThemeCache+", theme.id);
		this.themes[ theme.id ] = theme;
	},
	themeUrlFromId: function(id) {
		return '/t/' + id + '/theme.js';
	},
	themeIdFromUrl: function( url ) {
		var match = this.themeRegex.exec(url);
		if (!match)
			throw new Error("Malformed theme resource url " + url);
		return match[1];
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
		Noop.create = $.noop;
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
				console.log(ex.stack);
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
		// console.log('waiting', url);
		$.when.apply($, dependentDeferreds)
			.done( function() {
				// console.log('complete', url);
				window[callbackName] = success;
				try {
					eval(js + "//@ sourceURL=" + url);	// calls success and sets theme
				}
				catch(ex) {
					var lineNo = "";
					if ( ex.lineNumber ) {
						var e2 = ex.constructor();
						lineNo = " line " + (ex.lineNumber - e2.lineNumber + 5);
						console.log(ex.stack);
					}
					fail('theme parse failed ' + ex.message + lineNo + ' ' + url );
				}
			})
			.fail( function() {
				fail("dependency loading failed for theme " + url)
			});
	},

	load: function(url, options) {
		// console.log("loading", url);
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
			// console.log("ajax loading done", url);
				this.processLoadedTheme( deferred, callbackName, response, url );
			})
			.fail( function( jqXHR, status, msg ) {
				console.error( "ajax theme loading failed", status, msg, url );
				delete this.loading[url];
				ThemeCache.failed[url] = status + ' ' + msg;
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
			throw new Error("Malformed theme resource url " + resUrl);

		var themeId = match[1],
			pathStr = match[2];
		var theme = this.themes[themeId];
		if (!theme) {
			// console.warn("Theme not found", resUrl);
			var deferred = this.load( this.themeUrlFromId( themeId ));
			throw new ThemeNotFoundException("Theme not found " + resUrl, deferred);
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

