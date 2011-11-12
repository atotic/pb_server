"use strict"

//
// Book class
//
PB.Book = function(json) {
	this._stream = null;	// server socket stream
	if (json) {
		this._id = json.id;
		this.title = json.title;
		this._page_order = json.page_order; // gets out of date after pages are added
		this._photos = [];
		this._pages = [];
		this._template_id = json.template_id;
		this._last_server_cmd_id = json.last_server_cmd_id; // last command in server socket stream
		
		PB.BookTemplate.get(this._template_id);	// Preload template
		for (var i = 0; i < json.pages.length; i++)
			this._pages.push(new PB.BookPage(json.pages[i]));
		this.sortByPageOrder();
		for (var i = 0; i < json.photos.length; i++)
			this._photos.push(new PB.PhotoBroker(json.photos[i]))
	}
	else {
		this._id = 0;
		this.title = "";
		this._page_order = "";
		this._photos = [];
		this._pages = [];
	}
	$.extend(this, new PB.EventBroadcaster("imageAdded imageRemoved pageAdded pageDeleted pageReplaced serverStreamUpToDate"));
};

// Returns ajax XHR that loads the book
PB.Book.get = function(book_id) {
	return $.ajax({url: "/books/" + book_id})
};

// Book represents the photo book
// Look at constructor for the list of events
PB.Book.prototype = {
	get id() {
		return this._id;
	},
	get photos() {
		return this._photos;	// return PhotoBroker[]
	},
	get pages() { // return BookPage[]
		return this._pages;
	},
	get stream() {
		return this._stream;
	},
	get stream_id() {
		if (this._stream)
			return this._stream.id;
		return 0;
	},
	set stream(s) {
		if (this._stream != null && s != null)
			throw "Book can have ony one command stream";
		this._stream = s;
	},
	get template() {
		return PB.BookTemplate.getNow(this._template_id);
	},
	connectServerStream: function(forceReconnect) {
		if (this._stream && !forceReconnect)
			return;
		if (this._stream)
			this._stream.close();
		this.stream = PB.ServerStream.connect(this);
	},
	firstPage: function() {
		if (this._pages.length > 0)
			return this._pages[0];
		return null;
	},
	get last_server_cmd_id() {
		console.log("Returing last id ", this._last_server_cmd_id);
		return this._last_server_cmd_id;
	},
	set last_server_cmd_id(id) {
		console.log("Setting last id" , id);
		if (typeof id == "string")
			id = parseInt(id);
		if (id < this._last_server_cmd_id) {
			console.error("last_server_cmd_id too low");
			debugger;
		}
		else 
			this._last_server_cmd_id = id;
	},
	sortByPageOrder: function() {
		var pageOrder = this._page_order;
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
	getPageById: function(page_id) {
		debugger;	// should not be used
		for (var i=0; i<this._pages.length; i++)
			if (this._pages[i].id == page_id)
				return this._pages[i];
		console.warn("no such page id " + page_id);
	},
	
	getPhotoById: function(photo_id) {
		for (var i=0; i< this._photos.length; i++)
			if (this._photos[i].id == photo_id)
				return this._photos[i];
		return undefined;
	},
	getPhotoByFileUrl: function(url) {
		if (url == null)
			return null;
		for (var i=0; i< this._photos.length; i++)
			if (this._photos[i].getFileUrl() == url)
				return this._photos[i];
		return null;
	},
	addPhoto: function(photo) {
		if (this.getPhotoById(photo.id))
			return;	// Photo already exists
		var pos = this._photos.push(photo);
		this.send('imageAdded', photo, pos);
	},
	replacePage: function(page) {
		for (var i=0; i<this._pages.length; i++)
			if (this._pages[i].id == page.id) {
				this._pages[i] = page;
				this.send('pageReplaced', page);
				return;
			}
	},
	addPage: function(page, insertAfter) {
		this._pages.splice(insertAfter, 0, page);
		this.send('pageAdded', page, insertAfter, true);
	},
	deletePage: function(deleteAfter) {
		var page = this._pages.splice(deleteAfter, 1)[0];
		this.send('pageDeleted', page, deleteAfter);
		return page;
	},
	// If book has odd number of pages, it is inconsistent 
	hasOddPages: function() {
		var n = 0;
		this._pages.forEach(function(page) {
			if (page.position == 'middle')
				n += 1;
		});
		return (n % 2) != 0;
	}
};

PB.BookTemplate = function(json) {
	var THIS = this;
	["id", "width", "height", "initial_pages"].forEach(function(x) { THIS["_" + x] = json.x });
	this.pages = [];
	json.pages.forEach(function(x) { THIS.pages.push(new PB.PageTemplate(x)) }); 
}

// GET BookTemplate xhr
// Returns deferred that promises BookTemplate. Results are cached
// Usage:
// PB.BookTemplate.get("modern_lines")
//   .success( function(template) { console.log("got template " template.id) })
//   .error( function(template_id) { console.log("failed on " template_id) });
PB.BookTemplate.get = function(template_id) {
//	console.log("requesting " + template_id + " " + Date.now());
	if (PB.BookTemplate._cached == undefined) 
		PB.BookTemplate._cached = {};
	if (template_id in PB.BookTemplate._cached) {
//		console.log("returning cached " + Date.now());
		return $.Deferred().resolve( PB.BookTemplate._cached[template_id] );
	}
	var xhr = $.ajax( { url: "/templates/"+ template_id });
	var retVal = $.Deferred();
	xhr.success(function(data, textStatus, jqXHR) {
		PB.BookTemplate._cached[template_id] = new PB.BookTemplate(data);
//		console.log("returning resolved " + Date.now());
		retVal.resolve( PB.BookTemplate._cached[template_id] );
	});
	xhr.error( function( jqXHR, textStatus, errorThrown) {
		console.error("BookTemplate " + template_id + " failed to load");
		retVal.reject(template_id);
	});
	return retVal;	
};

// Convenience method for fetching templates we know are loaded
PB.BookTemplate.getNow = function(template_id) {
	if (PB.BookTemplate._cached && template_id in PB.BookTemplate._cached)
		return PB.BookTemplate._cached[template_id];
	throw "Template not loaded: " + template_id;
}

PB.BookTemplate.prototype = {
	getRandomPage: function(page_position) {
		var page = null;
		while (page == null || page.position != page_position)
			page = this.pages[Math.floor(Math.random() * this.pages.length)];
		return page;
	}
}


// ImageBrooker
PB.PhotoBroker = function(jsonOrFile) {
	if ('display_name' in jsonOrFile) {
		this.initFromJson(jsonOrFile);
	}
	else {
		this._id = this.getTempId();
		this._file = jsonOrFile;
	}
}

// PhotoBroker represents an image.
PB.PhotoBroker.prototype = {

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
	
	get id() {
		return this._id;
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
		
	getFile: function() {
		return _file;
	},
	
	getTempId: function() {
		return "temp-" + PB.PhotoBroker.prototype.tempId++;
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
