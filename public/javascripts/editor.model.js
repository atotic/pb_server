"use strict"
// Book class

PB.Book = function(json) {
	if (json) {
		this.id = json.id;
		this.title = json.title;
		this._page_order = json.page_order;
		this._images = [];
		this._pages = [];
		this._template_id = json.template_id;
		PB.BookTemplate.get(this._template_id);	// Preload template
		for (var i = 0; i < json.pages.length; i++)
			this._pages.push(new PB.BookPage(json.pages[i]));
		this.sortByPageOrder();
		for (var i = 0; i < json.photos.length; i++)
			this._images.push(new PB.ImageBroker(json.photos[i]))
	}
	else {
		this.id = 0;
		this.title = "";
		this._page_order = "";
		this._images = [];
		this._pages = [];
	}
	$.extend(this, new PB.EventBroadcaster("imageAdded imageRemoved pageAdded"));
};

// Returns ajax XHR that loads the book
PB.Book.get = function(book_id) {
	return $.ajax({url: "/books/" + book_id})
};

// Book represents the photo book
// Look at constructor for the list of events
PB.Book.prototype = {
	
	images: function() {
		return this._images;	// return ImageBroker[]
	},
	pages: function() { // return BookPage[]
		return this._pages;
	},
	page_order: function() { // [1,4,5]
		return this._page_order;
	},	
	firstPage: function() {
		if (this._pages.length > 0)
			return this._pages[0];
		return null;
	},
	sortByPageOrder: function() {
		var pageOrder = this.page_order();
		this._pages.sort(function(a, b) {
			var a_pos = pageOrder.indexOf(a.id);
			var b_pos = pageOrder.indexOf(b.id);
			if (a_pos < b_pos)
				return -1;
			else if (a_pos > b_pos)
				return 1;
			return 0;
		});
	},
	addLocalFileImage: function (file) {
		// Check if it matches any already 
		for (var i=0; i< this._images.length; i++)
			if (this._images[i].name() == file.name) 
			{
				PB.notice(file.name + " is already in the book.");
				return;
			};

		var image = new PB.ImageBroker(file);
		var pos = this._images.push(image);
		image.saveOnServer(this.id);
		this.send('imageAdded', image, pos);
	},		
	getPageById: function(page_id) {
		debugger;	// should not be used
		for (var i=0; i<this._pages.length; i++)
			if (this._pages[i].id == page_id)
				return this._pages[i];
		console.warn("no such page id " + page_id);
	},
	
	getImageById: function(image_id) {
		for (var i=0; i< this._images.length; i++)
			if (this._images[i].id() == image_id)
				return this._images[i];
		console.warn("no such image id " + image_id);
		return undefined;
	},
	getImageByFileUrl: function(url) {
		if (url == null)
			return null;
		for (var i=0; i< this._images.length; i++)
			if (this._images[i].getFileUrl() == url)
				return this._images[i];
		return null;
	}
};

PB.BookTemplate = function(json) {
	var THIS = this;
	["id", "width", "height", "initial_pages"].forEach(function(x) { THIS["_" + x] = json.x });
	this._pages = [];
	json.pages.forEach(function(x) { THIS._pages.push(new PB.PageTemplate(x)) }); 
}

// GET BookTemplate xhr
// Returns deferred that promises BookTemplate. Results are cached
// Usage:
// PB.BookTemplate.get("modern_lines")
//   .success( function(template) { console.log("got template " template.id) })
//   .error( function(template_id) { console.log("failed on " template_id) });
PB.BookTemplate.get = function(template_id) {
	if (PB.BookTemplate._cached == undefined) 
		PB.BookTemplate._cached = {};
	if (template_id in PB.BookTemplate._cached)
		return $.Deferred().resolve( PB.BookTemplate._cached[template_id] );
	var xhr = $.ajax( { url: "/templates/"+ template_id });
	var retVal = $.Deferred();
	xhr.success(function(data, textStatus, jqXHR) {
		PB.BookTemplate._cached[template_id] = new PB.BookTemplate(data);
		retVal.resolve( PB.BookTemplate._cached[template_id] );
	});
	xhr.error( function( jqXHR, textStatus, errorThrown) {
		console.log("BookTemplate " + template_id + " failed to load");
		retVal.reject(template_id);
	});
	return retVal;	
}; 

PB.PageTemplate = function(json) {
	var THIS = this;
	["id", "width", "height", 
		"page_position", "image_count", "text_count", "middle_style",
		"html", "icon"]
		.forEach(function(x) { THIS["_" + x] = json.x});
}

// ImageBrooker
PB.ImageBroker = function(jsonOrFile) {
	if ('display_name' in jsonOrFile) {
		this.initFromJson(jsonOrFile);
	}
	else {
		this._id = this.getTempId();
		this._file = jsonOrFile;
	}
}

// ImageBroker represents an image.
PB.ImageBroker.prototype = {

	tempId: 1,
	_file: null, // on-disk file
	_id: null,
	_fileUrl: null,
	
	error: null,

	initFromJson: function(json) {
		this._id = json.id;
		this._md5 = json.md5;
		this._display_name = json.display_name;
	},
	
	destroy: function() {
		if (this._fileUrl) {
			if ('URL' in window)
				window.URL.revokeObjectURL(this._fileUrl)
			else if ('webkitURL' in window)
					this._fileUrl = window.webkitURL.revokeObjectURL(this._fileUrl);		
		}
		this._fileUrl = null;
	},

	name: function() {
		if ('_display_name' in this)
			return this._display_name;
		else if ('_file' in this)
			return this._file.name;
		else
			return "no title";
	},
	
	id: function() {
		return this._id;
	},
	
	getFile: function() {
		return _file;
	},
	
	getTempId: function() {
		return "temp-" + PB.ImageBroker.prototype.tempId++;
	},
	
	// size is 'icon', 'display', 'full'
	getImageUrl: function(size) {
		if (this._file) {
			if (!("_fileUrl" in this) || this._fileUrl == null)
			{
				if ('URL' in window)
					this._fileUrl = window.URL.createObjectURL(this._file);
				else if ('webkitURL' in window)
					this._fileUrl = window.webkitURL.createObjectURL(this._file);
			}
			return this._fileUrl;
		}
		else 
			return this.getServerUrl(size);
	},

	getFileUrl: function() {
		if ("_fileUrl" in this)
			return this._fileUrl;
		return null;
	},
	
	getServerUrl: function(size) {
		if ((typeof this._id == "string") && this._id.match(/temp/)) {
			throw new Error("Server url still not available"); // TODO
		}
		if (size) {
			if (typeof size == 'number') {
				if (size < 256)
					size = 'icon';
				else if (size < 1280)
					size = 'display';
				else
					size = 'full'
			}
		}
		else
			size = "display";
		var url = "/photo/"	+ this._id;
		url += "?size=" + size;
		return url;	
	},
	
	saveOnServer: function(book_id) {
		this._book_id = book_id;
		PB.uploadQueue.upload(this);
	},
	
	createUploadDeferred: function() {
		var fd = new FormData();
		fd.append('display_name', this._file.name);
		fd.append('book_id', this._book_id);
		fd.append('photo_file', this._file);
		var THIS = this;
		var xhr = $.ajax({
			url: "/photos",
			type: "POST",
			data: fd,
			processData: false,
			contentType: false,
			xhr: function() {
				var xhr = new window.XMLHttpRequest();
				xhr.upload.addEventListener("progress", function(evt) {
					PB.progress( evt.lengthComputable ? evt.loaded * 100 / evt.total : -1);
				}, false);
				return xhr;
			}
		});
		xhr
			.done(function(json, status, xhr) {
				THIS._id = json.id;
				THIS._display_name = json.display_name;
				PB.progress();
			})
			.always(function() { 
				PB.progress();
			});
		return xhr;
	},
	
	// md5 returns deferred as computing md5 from disk might take a while
	getMd5: function() {
		var deferred = new $.Deferred();
		if ('_md5' in this)
			deferred.resolve(this._md5);
		else if (this._file) {
				// Compute md5 hash by reading from the file
				var reader = new FileReader();
				var THIS = this;
				reader.onload = function() {
					var t = new PB.Timer("md5");
					THIS._md5 = MD5(reader.result);
					t.end();
					deferred.resolve(this._md5);
				}
				reader.onerror = function() {
					deferred.reject("File could not be read. Error code " + reader.error);
				}
				reader.readAsBinaryString(this._file);
		}
		else
			deferred.reject("No hash, and no file to get it from");
		return deferred;
	},
	
	toCanvasFinalize: function(deferred, options, img) {
		if (this.error != null) {
			console.log(this.name() + " failed to load");
			return deferred.rejectWith(document, [this]);
		}
		// console.log(this.name() + " loaded");
		// Resize image to canvas
		var scale = options.desiredHeight / img.naturalHeight;
		var canvasWidth = Math.round(img.naturalWidth * scale);
		if (scale > 1)
			scale = 1;
		var canvasHeight = options.desiredHeight;
		var canvas = $("<canvas />")
			.attr('width', canvasWidth)
			.attr('height', canvasHeight)
			.data("imageBroker", this)
			.each(function(index, el) {
				el.getContext('2d').drawImage(img, 0,0, canvasWidth, canvasHeight);
			}).get(0);
		// Complete callback
		$(img).unbind();
		img.src = null;
		deferred.resolveWith(document, [canvas, this]);
	},
	
	// Copies image to canvas
	// Returns a deferred. done and fail will get (canvas, img) callbacks
	// deferred will have memorySize property set to memory footprint of loaded image
	toCanvas: function(options) {
		$.extend({
			desiredHeight: 128
		}, options);
		
		var THIS = this;
		var img = new Image();
		var deferred = PB.createDeferredJob("toCanvas " + this._id, function() {
			img.src = THIS.getImageUrl(options.desiredHeight);						
		});
		$(img).bind({
			load : function() {
				deferred.memory_size = 4 * img.width * img.height;
				THIS.toCanvasFinalize(deferred, options, img);
//					console.log("Loaded: " + self.name());
			},
			error : function(e) {
				THIS.error = "Image could not be loaded";
				THIS.toCanvasFinalize(deferred, options, img);
			},
			abort: function(e) {
				THIS.error = "Image loading was aborted";
				THIS.toCanvasFinalize(deferred, options, img);
			}
		});
		PB.ImageLoadQueue.push(deferred);
		return deferred;
	}
};

PB.BookPage = function(json) {
	for (var prop in json)	// make them all private
		this["_" + prop] = json[prop];
	this._dirty = {
		html: false,
		icon: false
	};
};

// Saves all dirty pages -- class method
PB.BookPage.saveAll = function() {
	PB.book().pages().forEach(function(page) {
		page.saveNow();
	});
}

$.extend(PB.BookPage, new PB.EventBroadcaster("pageIconUpdated"));

PB.BookPage.prototype = {
	get id() {
		return this._id;
	},
	get dirty() {
		return this._dirty.html || this._dirty.icon;
	},

	browserHtml: function() {
		if (this._html)	{
			// This will need fixing if we use other prefixed properties
			var html =  this._html.replace(/-webkit-transform/g, $.browserCssPrefix + "transform");
			html = html.replace(/-webkit-border-image/g, $.browserCssPrefix + "border-image");
			return html;
		}
		else
			return null;
	},
	innerHtml: function (node) {
		// Book editing needs prefixed CSS styles (-webkit-transform)
		// Our pdf engine expects -webkit styles
		// When saving, all prefix styles are saved with -webkit- prefixes
	  // styleToWebkit does this.
		// function styleToUserAgent reverses this
		function styleToWebkit(val) {
			var styles = val.split(";");
			var stylesToRemove = {};
			for (var i=0; i<styles.length; i++) {
				var nameval = styles[i].split(":");
				if (nameval.length != 2) continue;
				nameval[0] = nameval[0].trim();
				nameval[1] = nameval[1].trim();
				var m = nameval[0].match(/(-moz-|-webkit-|-ms-|-o-)(.+)/);
				if (m) { // m[1] is '-webkit'; m[2] is 'transform'
					// mutate -moz-transform:rotate(45) into transform:rotate(45);-webkit-transform:rotate(45);
					// assigns two values to single style entry, -webkit- and non-prefix
					var s = "-webkit-" + m[2] + ":" + nameval[1] + ";" + m[2] + ":" + nameval[1];
					styles[i] = s;
					stylesToRemove[m[2]] = true;
				}
			}
			for (var i=0; i<styles.length; i++) {
				var nameval = styles[i].split(":");
				if (nameval[0] in stylesToRemove)
					styles.splice(i--, 1);
			}
			return styles.join(";");
		}
		
		function serializeAttribute(a) {
			var output = a.localName.toLowerCase() + '="';
			var value = a.nodeValue;
			if (a.localName.toLowerCase() == "style")
				value = styleToWebkit(value);
			output += value.replace(/"/g, "&quot;");
			output += '"';
			return output;
		}
	
		var singles = {
			area:true, base:true, basefont:true, bgsound:true, br:true, col:true, command:true,
			embed:true,frame:true,hr:true, img:true, input:true, keygen:true, link:true, meta:true,
			param:true, source:true, track:true, wbr:true
		}
	
		function serializeElement(dom) {
			var output = "<" + dom.nodeName.toLowerCase();
	
			for (var i=0; i<dom.attributes.length; i++) 
				output += " " + serializeAttribute(dom.attributes.item(i));
	
			output += ">";
			if (! (dom.nodeName.toLowerCase() in singles)) {
				for (var i=0; i < dom.childNodes.length; i++)
					output += serializeNode(dom.childNodes.item(i));
				output += "</" + dom.nodeName.toLowerCase() + ">";
			}
			return output;
		}
	
		function serializeText(dom) {
			return dom.textContent.replace(/</g, "&lt;").replace(/>/g, "&gt;");
		}
	
		function serializeNode(node) {
			switch (node.nodeType) {
				case 1: // ELEMENT_NODE
					return serializeElement(node);
				case 3:	// Text
				case 4: // CData
					return serializeText(node);
				default:
					console.log("Not serializing node type " + dom.nodeType);
			}
			return "";
		}
	
		var output = "";
		for (var i=0; i < node.childNodes.length; i++)
			output += serializeNode(node.childNodes.item(i));
		return output;
	 // http://www.whatwg.org/specs/web-apps/current-work/multipage/the-end.html#html-fragment-serialization-algorithm
},

	// Reads HTML from DOM
	// Fixes up the html in canonical form:
	// - remove display artifacts; fix style declaration; patch up img src, etc
	readHtml: function() {
		if (this._displayDom == null) {
			console.warn("_displayDom is null");
			this._html = null;
			return;
		}
		var dom = this._displayDom.cloneNode(true);
		// Our src might be local files, change to server location
		$(dom).find("img").each(function(index, el) {
			// TODO we might not know server location until file is saved.
			var src = el.getAttribute("src");
			var serverSrc = PB.book().getImageByFileUrl(src);
			if (serverSrc != null)
				el.setAttribute("src", serverSrc.getServerUrl('display'));
		});
		// Remove display artifacts
		$(dom).find(".deleteme").each(function(index, el) {
			$(el).remove();
		});
		// Remove drag'n'drop artifacts
		$(dom).find(".ui-droppable").each( function(index, el) {
				$(el).removeClass("ui-droppable");	
		});
		this._html = this.innerHtml(dom);
	},

	// Sets dom element that is displaying the page
	setDisplayDom: function(domEl) {
		if (domEl && 'jquery' in domEl)
			domEl = domEl.get(0);
		if (domEl == null && this._displayDom && this._dirty.html)
			this.readHtml();
		this._displayDom = domEl;
	},
	// DOM must be set when modified
	setDomModified: function() {
		if (!this._displayDom)
			console.error("Page must be displayed when setDomModified");
		this._dirty.html = true;
	},
	// Returns DOM, and selects it in editor if necessary
	getDom: function() {
		if (this._displayDom == null)
			PB.UI.Pagetab.selectPage(this);
		if (this._displayDom == null) {
			console.error("Cannot get dom for BookPage");
			throw("No dom");
		}
		return this._displayDom;
	},

	// call before dom is disconnected
	saveNow: function() {
		if (this.dirty)
			PB.uploadQueue.upload(this);
	},

	// Call when a photo on a page has been changed
	// book_image_div contains the changed photo
	updateIcon: function(book_image_div) {
		// to update, need dom index, and img src
		book_image_div = $(book_image_div);
		var imageIndex = book_image_div.parents(".book-page").first()
			.find(".book-image")
			.toArray().indexOf(book_image_div.get(0));
		var img_tag = book_image_div.find(".actual-image");
		var img_src = img_tag.attr("src");
		if (img_src == undefined) {
			if (book_image_div.height() > book_image_div.width())
				img_src = "/assets/common/v1.jpg";
			else
				img_src = "/assets/common/h1.jpg";
		}
		// update the icon dom
		var icon_dom = $(this._icon);
		img_tag = icon_dom.find("img[data-img-pos="+imageIndex+"]");
		if (img_tag.length == 0) {
			console.error("updateIcon could not find matching image"); 
			return;
		}
		img_src = img_src.replace(/\?size=.*$/g, "");
		img_tag.attr("src", img_src + "?size=icon");
		
		// save changes
		this._icon = this.innerHtml($("<div/>").append(icon_dom).get(0));
		this._dirty.icon = true;
		PB.BookPage.send('pageIconUpdated', this);
	},
	createUploadDeferred: function() {
		// Gather data to be saved
		var savedHtml = false;
		var savedIcon = false;
		var data = {};
		if (this._dirty.html) {
			if (this._displayDom)
				this.readHtml();
			savedHtml = this._html;
			data.html = savedHtml;
		}
		if (this._dirty.icon) {
			data.icon = this._icon;
			savedIcon = this._icon;
		} 
		
		var xhr = $.ajax("/book_page/" + this._id, {
			data: data,
			type: "PUT"
		});
		var THIS = this;
		
		// Clear out the dirty flags on completion
		// Take care not to clear them out if page was modified while saving
		xhr.done(function(response, msg, jqXHR) {
			if (jqXHR.status == 200) {
				if (savedHtml) {
					if (THIS._displayDom)
						THIS.readHtml();
					if (THIS._html == savedHtml || THIS._html == null)
						THIS._dirty.html = false;
					else
						debugger;
				}
				if (savedIcon) {
					if (savedIcon == THIS._icon)
						THIS._dirty.icon = false;
				}
			}
		});
		return xhr;
	},
	
	// icon is a small div with images/etc
	toIcon: function(options) {
		$.extend({
			desiredHeight: 128
		}, options);
		var div = $(this._icon);
		var height = parseInt(div.css("height"));
		var width = parseInt(div.css("width"));
		var scale = options.desiredHeight / height;
		div.css("width", Math.round(width * scale) + "px");
		div.css("height", Math.round(height * scale) + "px");
		return div;
	}
};
