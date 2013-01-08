// editor.pb.templates.js

(function(scope) {

var cache = {};

var	Template = {
	// Predefined ids:
	THEME_LIST: '_config-themes',

	// id => template, returns deferred that yields the result.
	// return: a deferred
	// deferred result is a map id => object, { id => <requested object>, id => <requested_object> }
	get: function(idOrIdArray) { //takes <id> | [ id* ]
		if (idOrIdArray === null)
			throw "Template.get(id) id must not be null";

		var idList;
		if (typeof idOrIdArray == 'string')
			idList = [idOrIdArray];
		else
			idList = idOrIdArray.slice();

		var retVal = $.Deferred();

		if (idList.length === 0) {
			retVal.resolve({});
			return retVal;
		}

		var result = {};

		var missingIds = [];
		for (var i=0; i<idList.length; i++) {
			if (idList[i] in cache)
				result[ idList[i] ] = cache[ idList[i] ];
			else
				missingIds.push( idList[i] );
		}

		if (missingIds.length === 0) { // no need for network, we are good
			retVal.resolve(result);
			return retVal;
		}

		$.ajax({
			url: '/template/'+ missingIds.join(','),
			dataType: 'jsonp'
			})
			.done(function(response, msg, jqXHR) {
				for (var id in response) {
					Template.put(response[id]);
					result[id] = cache[id];
				}
				retVal.resolve(result);
			})
			.fail(function(jqXHR, status, msg) {
				// wish i could show only ids that failed, but there is no
				// way to evaluate jsonp outside of jquery
				console.warn("template loading failed", status, msg, missingIds.join(','));
				var retry = false;
				switch(jqXHR.status) {
					case 404:
					default:
						console.warn('template failed to load', status, msg);
						break;
				}
				retVal.reject(result);
			});
		return retVal;
	},
	// cached() returns only cached ids. It throws if id is not in the cache
	// useful when you do not want to deal with Deferreds, and know stuff is in
	// the cache
	cached: function(id) {
		if (typeof id != 'string')
			throw "id must be a string";
		if (id in cache)
			return cache[id];
		else
			throw new Error("cache id not found " + id);
	},
	// return theme|book|layout|image
	getClass: function(template) {
		// strict method: specify type in template
		if ('type' in template) {
			if (/config|theme|book|layout|image/.test(template.type))
				return template.type;
			else
				throw "Unknown template type " + template.type;
		}
		// guess: from template member name
		var retVal = null;
		if ('books' in template)
			retVal = 'theme';
		else if ('layouts' in template)
			retVal = 'book';
		else if ('pageClass' in template)
			retVal = 'layout';
		else if ('full' in template)
			retVal = 'image';
		else
			throw "Could not guess template type";
		return retVal;
	},
	put: function(template) {
		var templateExtend;
		switch(this.getClass(template)) {
			case 'theme':
				templateExtend = new PB.Template.Theme(template);
				break;
			case 'book':
				templateExtend = new PB.Template.Book(template);
				break;
			case 'layout':
				templateExtend = new PB.Template.Layout(template);
				break;
			case 'image':
			case 'config':
			default:
				templateExtend = template;
				break;
		}
		templateExtend.freeze;	// templates cannot modify their data
		cache[templateExtend.id] = templateExtend;
	}
}

scope.Template = Template;
})(PB);

(function(scope) {
	var DPI = 96;

	var Theme = function(t) {
		$.extend(this, t);
	};
	Theme.prototype = {
	}
	scope.Theme = Theme;

	var Book = function(t) {
		$.extend(this, t);
	};
	Book.prototype = {
		get pixelWidth() {
			return this.width * DPI;
		},
		get pixelHeight() {
			return this.height * DPI;
		},
		loadLayoutTemplates: function() {
			return PB.Template.get(this.layouts);
		},
		getMatchingLayouts: function(query) {
			var retVal = [];
			for (var i = 0; i< this.layouts.length; i++) {
				var layout = PB.Template.cached(this.layouts[i]);
				var pageClassOk = 'pageClass' in query && layout.pageClass == query.pageClass;
				var photoCountOk = pageClassOk && 'photoCount' in query
					&& 'preferredPhotoCount' in layout
					&& layout.preferredPhotoCount.indexOf(query.photoCount) != -1;
				if ( photoCountOk && pageClassOk )
					retVal.push(layout);
			}
			if (retVal.length === 0)
				retVal.push( PB.Template.cached('default_layout'));
			return retVal;
		}
	}
	scope.Book = Book;

	var Layout = function(t) {
		$.extend(this, t);
	};

	Layout.prototype = {
		getFallbackLayout: function() {
			var fallbackId = this.fallback_layout_id || 'default_layout';
			return PB.Template.cached(fallbackId);
		},
		getWidth: function(page) {
			var inches = this.width || PB.Template.cached(page.book.bookTemplateId).width;
			switch(page.pageClass) {
				case 'back-flap':
				case 'cover-flap':
					inches /= 3;
					break;
				default: break;
			}
			return inches * DPI;
		},
		getHeight: function(page) {
			var inches = this.height || PB.Template.cached(page.book.bookTemplateId).height;
			return inches * DPI;
		},
		getEditMenu: function(page, layoutItemId) {
			return ['pan', 'move', 'zoom', 'resize', 'rotate', 'clear', 'touchup'];
		},
		pageChanged: function(page, dom, resolution, ev, model, prop, options) {
			var newDom = this.generateDom(page, { resolution: resolution});
			dom.children().detach();
			dom.append(newDom.children());
		},
		_generatePhotoDom: function(photo, enclosingDim, options) {
			var initPhoto = new GUI.Rect(photo.dimensions);
			var initEnclosure  = new GUI.Rect(enclosingDim);
			var initViewport = new GUI.Rect(photo.dimensions);
			initViewport = initViewport.forceInside(initPhoto); // just for safety

			switch(options.style) {
				case 'fit':
					var scale = initViewport.fitInside(initEnclosure);
					var scaledViewport = initViewport.scaleBy(scale, true);
					var finalPhoto = initPhoto.scaleBy(scale);
					var maxViewport = finalPhoto.intersect(initEnclosure);
					var sizedViewport = scaledViewport.moveBy(
						-(maxViewport.width - scaledViewport.width) / 2,
						-(maxViewport.height - scaledViewport.height) /2);
					sizedViewport.height = maxViewport.height;
					sizedViewport.width = maxViewport.width;
					var finalViewport = sizedViewport.forceInside(finalPhoto);
					break;
				case 'fill':
					var scale = initViewport.fillInside(initEnclosure);
					var scaledViewport = initViewport.scaleBy(scale, true);
					var centeredViewport = scaledViewport.centerIn(initEnclosure);
					var finalViewport = scaledViewport.moveBy(-centeredViewport.x, -centeredViewport.y);
					var finalPhoto = initPhoto.scaleBy(scale);
					break;
			}
			var info = photo.getUrl(options.resolution);
			var img = $(document.createElement('img'))
				.addClass('design-photo-img')
				.prop('src', info.url)
				.css({
						top: -finalViewport.top,
						left: -finalViewport.left,
						width: finalPhoto.width,
						height: finalPhoto.height
				});
			var outerFrame = finalViewport.centerIn(initEnclosure).intersect(initEnclosure);
			var innerDiv = $(document.createElement('div'))
				.addClass('design-photo-inner')
				.css({
					width: outerFrame.width,
					height: outerFrame.height
				})
				.append(img);
			var outerDiv = $(document.createElement('div'))
				.addClass('design-photo')
				.data('model_id', photo.id)
				.css({
					top: outerFrame.top,
					left: outerFrame.left,
					width: outerFrame.width,
					height: outerFrame.height
				})
				.append(innerDiv);
			return outerDiv;
		},
		generateDom2: function(page, resolution) {	// resolution: PhotoProxy.SMALL|MEDIUM|LARGE
			var width = this.getWidth(page);
			var height = this.getHeight(page);
			var retVal = $(document.createElement('div'));
			var THIS = this;
			retVal.css({
					width: width,
					height: height
				})
				.data('model_id', page.id)
				.on( PB.MODEL_CHANGED, function(ev, model, prop, options) {
					THIS.pageChanged(page, retVal, resolution,  ev, model, prop, options);
				});

			var style = 'fit';
			var photos = page.photos();
			var perRow = Math.floor(Math.sqrt(photos.length) + 0.99);
			var dim = new GUI.Rect({width: width / perRow, height: height /perRow});

			for (var v=0; v < perRow; v++)
				for (var h=0; h < perRow; h++) {
					var imgIdx = v * perRow + h;
					if (imgIdx >= photos.length)
						break;
					var photoDiv = this._generatePhotoDom(photos[imgIdx], dim, {
						style:style,
						resolution: resolution
					});
					photoDiv.css('top', parseFloat(photoDiv.css('top')) + v * dim.height);
					photoDiv.css('left', parseFloat(photoDiv.css('left')) + h * dim.width);
					retVal.append(photoDiv);
				}
			return retVal;
		},
		generateDom: function(page, options) {
			options = $.extend({
				liveRefresh: false,
				resolution: PB.PhotoProxy.MEDIUM,
				largeText: false,
				width: this.getWidth(page),
				height: this.getHeight(page)
			}, options);
			var retVal = $(document.createElement('div'))
				.css({ width: options.width, height: options.height });
			try {
				var allItems = page.allItems();
				var photoItems = allItems.filter(function(item) { return item.type == 'photo'});
				var photoPositions = this.getPhotoPositions(page, photoItems, options);
				var photoOptions = {
					style: 'fit',
					resolution: options.resolution
				};
				for (var i=0; i<allItems.length; i++) {
					switch(allItems[i].type) {
						case 'photo':
							var position = photoPositions.pop();
							var photo = page.book.photo(allItems[i].resource_id);
							var photoDiv = this._generatePhotoDom(photo, {width: position.width, height: position.height}, photoOptions);
							photoDiv.css('top', parseFloat(photoDiv.css('top')) + position.top);
							photoDiv.css('left', parseFloat(photoDiv.css('left')) + position.left);
							retVal.append(photoDiv);
					}
				}
			}
			catch(e) {
				debugger;
				// load resources here
				retVal.addClass('incomplete');
			}
			return retVal;
		},
		getPhotoPositions: function(page, photoItems, options) {
			if (('photoPositions' in this) && photoItems.length in this.photoPositions)
				return this.photoPositions[photoItems.length].slice();
			else
				return this.getFallbackLayout().getPhotoPositions(page, photoItems, options);
		}
	}

	scope.Layout = Layout;

// Default implementation of layout
	layout_algorithmic = {
		id: 'default_layout',
		pageClass: '*',
		getPhotoPositions: function(page, photoItems, options) {
			var retVal = [];
			var perRow = Math.floor(Math.sqrt(photoItems.length) + 0.99);
			var width = this.getWidth(page) / perRow;
			var height = this.getHeight(page) / perRow;

			for (var v=0; v < perRow; v++)
				for (var h=0; h < perRow; h++) {
					if (photoItems.length == retVal.length)
						return retVal;
					retVal.push({top: v * height, left: h * width, width: width, height: height});
				}
			return retVal;
		}
	}
	PB.Template.put(layout_algorithmic);

})(PB.Template);

BookThemeAPI = {
	setBookTemplate: function(themeId, bookTemplateId) {
		var changed = false;
		if (bookTemplateId != this.bookTemplateId) {
			this.localData.document.bookTemplateId = bookTemplateId;
			PB.broadcastChange(this, 'bookTemplateId');
			changed = true;
		}
		if (this.themeId != themeId) {
			this.localData.document.themeId = themeId;
			PB.broadcastChange(this, 'themeId');
			changed = true;
		}
		if (changed === true)
			PB.broadcastChange(this, 'template');
	},
	loadTemplates: function() {
		// loads all templates the book needs: theme, bookTemplate, and layoutTemplates from the book
		// after loadTemplates, all templates are guaranteed to be in template cache
		var retVal = $.Deferred();
		var THIS = this;
		PB.Template.get([this.bookTemplateId, this.themeId])
			.done(function(t) {
				t[THIS.bookTemplateId].loadLayoutTemplates()
					.done(function() {
						retVal.resolve();
					})
					.fail(function() {
						retVal.reject("Could not load layouts");
					});
				})
			.fail(function() {
				retVal.reject("Could not load bookTemplateId or themeId");
			});
		return retVal;
	},
	generateAllPagesHtml: function(failCb) {	// failCb(msg)
		var THIS = this;
		this.loadTemplates()
			.done( function() {
				var bookTemplate = PB.Template.cached(THIS.bookTemplateId);
				for (var i=0; i< THIS.localData.document.pageList.length; i++) {
					var page = THIS.page( THIS.localData.document.pageList[i]);
					THIS.assignTemplate(page);
				}
			})
			.fail(function(reason ) { failCb("failed to load book templates " + reason) } );
	},
	assignTemplate: function(page) {
		var bookTemplate = PB.Template.cached(this.bookTemplateId);
		var layoutTemplates = bookTemplate.getMatchingLayouts({
						pageClass: page.pageClass,
						photoCount: page.itemsByType('photo').length
					});
		var layout = layoutTemplates[0];
		page.layoutId = layout.id;
	}
}

$.extend(PB.Book.prototype, BookThemeAPI);


