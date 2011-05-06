"use strict";

// jQuery extensions
(function(jQuery){

/*
 * reflowVisible  
 * Solves the problem of "cannot reflow an hidden element because hidden elements have no dimensions"
 It takes a reflow function, and calls it:
 * a) immediately if element is visible
 * b) before element will be shown, if element is hidden
 * usage: 
 * $().reflowVisible() 
 *   call this after show();
 * $().reflowVisible( function(immediate)) sets the reflow function
 *   this is the $(element shown), immediate if the reflow function is immediate (animate here)
 */
	jQuery.fn.reflowVisible = function(reflow) {
		this.each(function() {
			if (reflow)
				$(this).data('reflow-visible', reflow);
			var visible = $(this).is(':visible');
			var immediate = visible && reflow != undefined
			if (!reflow || visible) {
				var cb = $(this).data('reflow-visible');
				if (!cb)
					return;
				var showHelper = new PB.fn.ShowForMeasure(this);
//				console.log('reflow performed ' + immediate);
				showHelper.startMeasure();
				try {
					cb.apply(this, [immediate]);
				} 
				catch (e) {
					console.log("exception in reflow callback");
				}
				showHelper.endMeasure();
				$(this).removeData('reflow-visible');
			}
//			else
//				console.log('reflow postponed');
		});
	};
/*
 * Sliders scroll by making left margin negative
 * This code will reveal the child element by fixing the margin
 */
	jQuery.fn.revealByMarginLeft = function(childFilter, animate) {
		var child = this.contents().filter(childFilter);
		if (child.size() == 0) {
			console.warn("No child to reveal");
			return;
		}
		var lastChild = this.children().last();
		var rightmostEdge = lastChild.position().left + lastChild.outerWidth() + Math.abs(parseInt(this.css("margin-left")));
		// Limit scrolling to now show empty space on the right
		var leftLimit = rightmostEdge - this.parent().width();
		leftLimit = Math.max(0, leftLimit);
		
		var left = child.position().left + Math.abs(parseInt(this.css("margin-left")));
		if (left > leftLimit)
			left = leftLimit;
		this.clearQueue().animate({ 
			"margin-left": "-" + Math.abs(left) + "px"
			}, {
				duration: 200
			});	
	};
	
	jQuery.fn.flippy
	
	function svgWrapper(el) {
		this._svgEl = el;
		this.__proto__ = el;
		Object.defineProperty(this, "className", {
			get:  function(){ return this._svgEl.className.baseVal; },
			set: function(value){    this._svgEl.className.baseVal = value; }
		});
		Object.defineProperty(this, "width", {
			get:  function(){ return this._svgEl.width.baseVal.value; },
			set: function(value){    this._svgEl.width.baseVal.value = value; }
		});
		Object.defineProperty(this, "height", {
			get:  function(){ return this._svgEl.height.baseVal.value; },
			set: function(value){    this._svgEl.height.baseVal.value = value; }
		});
		Object.defineProperty(this, "x", {
			get:  function(){ return this._svgEl.x.baseVal.value; },
			set: function(value){    this._svgEl.x.baseVal.value = value; }
		});
		Object.defineProperty(this, "y", {
			get:  function(){ return this._svgEl.y.baseVal.value; },
			set: function(value){    this._svgEl.y.baseVal.value = value; }
		});
		Object.defineProperty(this, "offsetWidth", {
			get:  function(){ return this._svgEl.width.baseVal.value; },
			set: function(value){    this._svgEl.width.baseVal.value = value; }
		});
		Object.defineProperty(this, "offsetHeight", {
			get:  function(){ return this._svgEl.height.baseVal.value; },
			set: function(value){    this._svgEl.height.baseVal.value = value; }
		});
	};

	jQuery.fn.wrapSvg = function() {
		return this.map(function(i, el) {
			if (el.namespaceURI == "http://www.w3.org/2000/svg" && 
				!('_svgEl' in el)) {
				var x =  new svgWrapper(el);
				return x;
			}
			else
				return el;
		});
	};
	
	// Creates a "flippy" UI element
	// state: 'open'|'closed'
	// flippyContent: content to show when flippy opens
	// clickEl: element that accepts the click, defaults to flippy
	jQuery.fn.flippy = function(state, flippyContent, clickEl) {
		if (this.length == 0)
			return;
		var flippy = $(this[0]);
		flippy.addClass('flippy');
		flippy.attr('state', state);
		if (state == 'open')
			flippyContent.show();
		else
			flippyContent.hide();
		clickEl = clickEl.length == 0 ? flippy : clickEl[0]
		$(clickEl).click( function(e) {
			var timing = 100;
			if (flippy.attr('state') == 'closed') {
				flippy.attr('state', 'open');
				flippyContent.show(timing);
			}
			else {
				flippy.attr('state', 'closed');
				flippyContent.hide(timing);
			}
			e.preventDefault();
		})
		.css("cursor", "pointer");
		return this;
	};
	
})(window.jQuery);


// Timer utility class
PB.fn.Timer = function(name) {
	this.startMili = Date.now();
	this.endMili = this.startMili;
	this.name = name;
}
$.extend(PB.fn.Timer.prototype, {
	start: function() {
		this.startMili = Date.now();
		return this;
	},
	end: function(msg) {
		this.endMili = Date.now();
		var message = msg || " executed in ";
		var total = this.endMili - this.startMili;
		console.log(this.name + message + total + " ms");
	}
});

/* Helper for measuring hidden dimensions
 * briefly shows all the hidden parents of the element
 * Usage:
 * var hide = new PB.fn.HiddenDimensions(el)
 * hide.startMeasure()
 * hide.endMeasure()
 * http://devblog.foliotek.com/2009/12/07/getting-the-width-of-a-hidden-element-with-jquery-using-width/
 */
PB.fn.ShowForMeasure = function(el) {
	this.el = $(el);
};

PB.fn.ShowForMeasure.prototype = {
	props:	{ position: 'absolute', visibility: 'hidden', display: 'block' },
	startMeasure: function() {
		this.hiddenParents = this.el.parents().andSelf().not(':visible').get();
		this.oldProps = new Array(this.hiddenParents.length);
		for (var i=0; i< this.hiddenParents.length; i++)
		{
			this.oldProps[i] = {};
			for (var name in this.props) {
				this.oldProps[i][name] = this.hiddenParents[i].style[name];
				this.hiddenParents[i].style[name] = this.props[name];
			}
		}
	},
	endMeasure: function() {
		for (var i=0; i< this.hiddenParents.length; i++) {
			for (var name in this.props)
				this.hiddenParents[i].style[name] = this.oldProps[i][name];
		}
	}
};

// Event broadcaster mixin. Use to extend any object as event broadcaster
// Usage:
// function MyBroadcaster() {
//		...your init code here ....
//   $.extend(this, new PB.fn.EventBroadcaster("docLoaded"));
// }
// Listeners can bind & unbind.
// Send events:
// this.send('docLoaded', doc);

PB.fn.EventBroadcaster = function(eventList) {
	this.listeners = {};
	var that = this;
	eventList.split(' ').forEach( function(val, index, arr) {
		that.listeners[val] = [];
	});
};

$.extend(PB.fn.EventBroadcaster.prototype, {
	bind: function(eventType, handler) {
		if (!eventType in this.listeners)
			throw "unknown event type " + eventType;
		this.listeners[eventType].push(handler);
	},
	unbind: function(eventType, handler) {
		if (!eventType in this.listeners)
			throw "unknown event type " + eventType;
		var i = this.listeners[eventType].indexOf(handler);
		if (i != -1)
			this.listeners[eventType].splice(i, 1);
	},
	send: function(eventType /* optional args */) {
		if (!eventType in this.listeners)
			throw "unknown event type " + eventType;
		for (var i=0; i < this.listeners[eventType].length; i++) {
			var f = this.listeners[eventType][i];
			switch(arguments.length) {
			case 1:
				f.call(); 
				break;
			case 2:
				f.call(null, arguments[1]); 
				break;
			case 3:
				f.call(null, arguments[1], arguments[2]); 
				break;
			default:
				throw("Cannot send this many arguments: " +(arguments.length - 1));
			}
		};
	}
});

// Book class

PB.fn.Book = function(json) {
	if (json) {
		this.id = json.id;
		this.title = json.title;
		this._images = [];
		this._pages = [];
		for (var i = 0; i < json.pages.length; i++)
			this._pages.push(new PB.fn.BookPage(json.pages[i]));
		for (var i = 0; i < json.photos.length; i++)
			this._images.push(new PB.fn.ImageBroker(json.photos[i]))
	}
	else {
		this.id = 0;
		this.title = "";
		this._images = [];
		this._pages = [];
	}
	$.extend(this, new PB.fn.EventBroadcaster("imageAdded imageRemoved pageAdded"));
};

// Book represents the photo book
// Look at constructor for the list of events
PB.fn.Book.prototype = {
	
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

		var image = new PB.fn.ImageBroker(file);
		var pos = this._images.push(image);
		image.saveOnServer(this.id);
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
PB.fn.ImageBroker = function(jsonOrFile) {
	if ('display_name' in jsonOrFile) {
		this.initFromJson(jsonOrFile);
	}
	else {
		this._id = this.getTempId();
		this._file = jsonOrFile;
	}
}

// ImageBroker represents an image.
PB.fn.ImageBroker.prototype = {

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
		if (this._fileUrl)
			window.URL.revokeObjectURL(this._fileUrl)
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
		return "temp-" + PB.fn.ImageBroker.prototype.tempId++;
	},
	
	// size is 'icon', 'display', 'full'
	getImageUrl: function(size) {
		if (this._file) {
			if (!("_fileUrl" in this))
				this._fileUrl = window.URL.createObjectURL(this._file);
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
	saveOnServer: function(book_id) {
		var fd = new FormData();
		fd.append('display_name', this._file.fileName);
		fd.append('book_id', book_id);
		fd.append('photo_file', this._file);
		var xhr = new XMLHttpRequest();	// not using jQuery, we want to use FormData,
		var THIS = this;
		xhr.onreadystatechange = function(evt) {
			if (xhr.readyState == 1)
				PB.progressSetup();
			if (xhr.readyState == 4) {
		 		if(xhr.status == 200) {
		 			PB.progress("File uploaded successfully");
		 			THIS.initFromJson($.parseJSON(xhr.responseText));
		 		}
				else
					console.error("Error saving image");
			}
		};
		xhr.upload.addEventListener("progress", function(evt) {
			if (evt.lengthComputable)
				PB.progress(evt.loaded / evt.total);
			else
				PB.progress(-1);
		}, false);
		xhr.open("POST", "/photos");
		xhr.send(fd);
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
					var t = new PB.fn.Timer("md5");
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
		if (scale > 1)
			scale = 1;
		var canvasWidth = Math.round(img.naturalWidth * scale);
		var canvasHeight = options.desiredHeight;
		var canvas = $("<canvas />")
			.attr('width', canvasWidth)
			.attr('height', canvasHeight)
			.data("image_id", this._id)
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
		var deferred = new $.Deferred();
		$.extend({
			desiredHeight: 128
		}, options);
		
		var THIS = this;
		var img = new Image();
		$(img).bind({
			load : function() {
				deferred.memorySize = 4 * img.width * img.height;
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
		PB.ImageLoadQueue.push(deferred, function() {
//	console.log("Started: " + self.name());
			img.src = THIS.getImageUrl(options.desiredHeight)
		});
		return deferred;
	}
};

PB.fn.BookPage = function(json) {
	for (var prop in json)	// make them all private
		this["_" + prop] = json[prop];
	this._dirty = false;
};

PB.fn.BookPage.prototype = {
	html: function() {
		return this._html;
	},
	get id() {
		return this._id;
	},
	dirty: function() {
		return this._dirty;
	},
	setHtml: function(newHtml) {
		// HTML needs cleanup of <image> tags:
		// FF does not close svg:image tags https://bugzilla.mozilla.org/show_bug.cgi?id=652243
		// FF uses href, not xlink:href
		// Our src might be local files, change to server location
		// Bug: we might not know server location until file is saved.
		// fixing that will be a bitch
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
		this.setDirty();
	},
	setDirty: function() {
		this._dirty = true;
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

// Image loading queue
// Limits how many images:
// - can be downloaded simultaneusly
// - can be downloaded in a 10 second window. This is to prevent
//	 memory trashing, FF keeps all images in used memory for 10 seconds, 
//   unused for 25. When loading images off local disk, single image can be
//   4928 x 3264 x 4 = 60MB undecoded.
// 	 TestPix loads 100 images in 64s
// gfx/surface/image cache can still grow to 1.X

PB.ImageLoadQueue = {
	activeLimit: 20,
	liveLimit: 1,	// concurrent image loads
	timeLimit: 10, // how long do we count a job to hold image in memory
	imageCacheLimit: 600 * 1048576,	// 600MB
	active: [],	// Array of [deferred, timeExpires, live, size]
	waiting: [], // Array of [deferred, fn]
	
	activeObject: function(deferred) {
		this.deferred = deferred;
		this.size = 0;
		this.expireTime = Date.now() + PB.ImageLoadQueue.timeLimit * 1000;
		this.live = true;
		this.memorySize = 0;
	},
	push: function(deferred, fn) {
		this.waiting.push([deferred, fn]);
		this.process();
	},
	execute: function(deferred, fn) {
		this.active.push(new this.activeObject(deferred));
		var self = this;
		deferred.done(function() {
			// Mark job as inactive
			for (var i=0; i< self.active.length; i++)
				if (self.active[i].deferred == deferred) {
					self.active[i].live = false;
					if ('memorySize' in deferred)
						self.active[i].memorySize = deferred.memorySize;
			}
			self.timer.imagesLoaded += 1;
			self.process(); // Process any new jobs
		});
		fn();
	},
	process: function() {
		if (! ("timer" in this )) {
			this.timer = new PB.fn.Timer("Image queue").start();
			this.timer.imagesLoaded = 0;
		}
		// remove inactive jobs
		var expiry = Date.now();
		var liveJobs = 0;
		var imageCacheSize = 0;
		for (var i=0; i< this.active.length; i++) {
			// Remove inactive/expired jobs
			if (this.active[i].expireTime < expiry) { 
				this.active.splice(i, 1);
				i -= 1;
			}
			else {
				imageCacheSize += this.active[i].memorySize;
				// Count live jobs
				if (this.active[i].live)
					liveJobs += 1;
			}
		}
		// Fill up the work queue
//		console.log("Waiting:" + this.waiting.length + " Active:" + this.active.length + " imageCacheSize:" + imageCacheSize + " liveJobs:" + liveJobs);
		while (this.waiting.length > 0
				&& this.active.length < this.activeLimit
				&& imageCacheSize < this.imageCacheLimit
				&& liveJobs < this.liveLimit) {
			var rec = this.waiting.shift();
			this.execute(rec[0], rec[1]);
			liveJobs += 1;
		}
		// Set up heartbeat if no jobs complete and call us back
		if (this.waiting.length > 0 && liveJobs == 0) {
			var self = this;
			window.setTimeout(function() {
				self.process();
			}, 1000);
		}
//		this.timer.end("LIQ::process, images " + this.timer.imagesLoaded + " executed in ");
	}
};
