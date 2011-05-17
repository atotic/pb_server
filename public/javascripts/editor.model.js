// Book class

PB.Book = function(json) {
	if (json) {
		this.id = json.id;
		this.title = json.title;
		this._images = [];
		this._pages = [];
		for (var i = 0; i < json.pages.length; i++)
			this._pages.push(new PB.BookPage(json.pages[i]));
		for (var i = 0; i < json.photos.length; i++)
			this._images.push(new PB.ImageBroker(json.photos[i]))
	}
	else {
		this.id = 0;
		this.title = "";
		this._images = [];
		this._pages = [];
	}
	$.extend(this, new PB.EventBroadcaster("imageAdded imageRemoved pageAdded"));
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
	
	firstPage: function() {
		if (this._pages.length > 0)
			return this._pages[0];
		return null;
	},
	
	addLocalFileImage: function (file) {
		// Check if it matches any already 
		for (var i=0; i< this._images.length; i++)
			if (this._images[i].name() == file.fileName) 
			{
				PB.notice(file.fileName + " is already in the book.");
				return;
			};

		var image = new PB.ImageBroker(file);
		var pos = this._images.push(image);
		image.saveOnServer(this.id, false);
		this.send('imageAdded', image, pos);
	},
		
	getPageById: function(page_id) {
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
			return this._file.fileName;
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
			debugger; // Should throw deferred, so we can wait until image is created
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
	
	saveOnServer: function(book_id, jumpQueue) {
		var fd = new FormData();
		fd.append('display_name', this._file.fileName);
		fd.append('book_id', book_id);
		fd.append('photo_file', this._file);
		var THIS = this;
		var startFn = function() {
			PB.progressSetup({message: "-> " + THIS.name(), show:true});
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
			})
			xhr
				.done(function() {
					PB.progress();
					var filter = PB.DeferredFilter.getNetworkErrorFilter();
					filter.setNetworkError(false);
					job.resolve();
				})
				.fail(function() { 
					PB.progress();
					var filter = PB.DeferredFilter.getNetworkErrorFilter();
					filter.setNetworkError(true);
					job.reject();			
					THIS.saveOnServer(book_id, true);
				})
				.complete(function() { 
				});	
		};
		var job = PB.createDeferredJob("Save " + this.name(), startFn);
		if (jumpQueue)
			PB.ImageUploadQueue.unshift(job);
		else
			PB.ImageUploadQueue.push(job);
		return job;
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
		console.log(this.name() + " loaded");
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
		img.src = "";
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
	this._dirty = null;
};

PB.BookPage.prototype = {
	html: function() {
		return this._html;
	},
	get id() {
		return this._id;
	},
	setHtml: function(domEl) {
		// HTML needs cleanup of <image> tags:
		// FF does not close svg:image tags https://bugzilla.mozilla.org/show_bug.cgi?id=652243
		// FF uses href, not xlink:href
		// Our src might be local files, change to server location
		// Bug: we might not know server location until file is saved.
		// fixing that will be a bitch
		var newHtml = domEl.innerHTML;
		var split = newHtml.split(/(<image[^>]*>)/im); // use image tags as line separators
		for (var i=0; i<split.length; i++) {
			// split image into components
			var match = split[i].match(/(<image[^>]*)(href=")([^"]*)(".*)/mi)
			if (match) {
				var front = match[1];
				var href = match[2];
				var fileLoc = match[3];
				var back = match[4] + "</image>";
				href = "xlink:" + href;
				var possibleImg = PB.book().getImageByFileUrl(fileLoc);
				if (possibleImg)
					fileLoc = possibleImg.getServerUrl('display');
				split[i] = front + href + fileLoc + back;
			}
		}
		var z = split.reduce(function(prev, current, index, arry) {
			return prev + current;
		}, "");
		this._html = z;
	},
	// domEl contains new contents of the page
	setDirty: function(domEl) {
		this._dirty = domEl;   
	},
	doneEditing: function() {
		//setHtml(domEl);
	},
	saveOnServer: function() {
		if (!this._dirty)
			return;
		$.ajax("/book_page/" + this._id, {
			data: { html: this._html },
			type: "PUT"
		});
	},
	toCanvas: function(options) {
		$.extend({
			desiredHeight: 128
		}, options);
		var height = parseFloat(this._height);
		var width = parseFloat(this._width);
		var scale = options.desiredHeight / height;
		var canvasWidth = Math.round(width * scale);
		var canvasHeight = options.desiredHeight;
		var canvas = $("<canvas />")
			.attr('width', canvasWidth)
			.attr('height', canvasHeight).get(0);
		var c2d = canvas.getContext('2d');
		c2d.fillStyle = 'blue';
		c2d.rect(1,1, canvasWidth - 2, canvasHeight -2);
		c2d.fill();
		c2d.stroke();
		c2d.rect(10,10,10,10);
		c2d.rect(50,100,20,20);
		c2d.stroke();
		return canvas;
	}
};
