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
			throw "id not found";
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
				if (('imageCount' in query && layout.imageCount == query.imageCount)
				 	&& ( 'pageClass' in query && layout.pageClass == query.pageClass))
					retVal.push(layout);
			}
			if (retVal.length === 0)
				retVal.push( PB.Template.cached('layout_algorithmic'));
			return retVal;
		}
	}
	scope.Book = Book;

	var Layout = function(t) {
		$.extend(this, t);
	};

	Layout.prototype = {
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
			var newDom = this.generateDom(page, resolution);
			dom.children().detach();
			dom.append(newDom.children());
		},
		_generatePhotoDiv: function(photo, enclosingDim, options) {
			var initPhoto = new GUI.Rect(photo.dimensions);
			var initEnclosure  = new GUI.Rect(enclosingDim);
			var initViewport = new GUI.Rect(photo.dimensions);
			initViewport = new GUI.Rect({top:200, left: 200, width: 200, height: 200});
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
		generateDom: function(page, resolution) {	// resolution: PhotoProxy.SMALL|MEDIUM|LARGE
			var width = this.getWidth(page);
			var height = this.getHeight(page);
			var retVal = $('<div/>');
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
					var photoDiv = this._generatePhotoDiv(photos[imgIdx], dim, {
						style:style,
						resolution: resolution
					});
					photoDiv.css('top', parseFloat(photoDiv.css('top')) + v * dim.height);
					photoDiv.css('left', parseFloat(photoDiv.css('left')) + h * dim.width);
					retVal.append(photoDiv);
				}
			return retVal;
		}
	}
	scope.Layout = Layout;

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
//				var bookTemplate = PB.Template.cached(THIS.bookTemplateId);
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
						imageCount: page.photoList.length
					});
		var layout = layoutTemplates[0];
		page.layoutId = layout.id;
	}
}

$.extend(PB.Book.prototype, BookThemeAPI);

layout_algorithmic = {
	id: 'layout_algorithmic',
	pageClass: '*'
}

PB.Template.put(layout_algorithmic);


