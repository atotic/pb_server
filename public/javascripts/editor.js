
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
				$(this).data('reflowVisible', reflow);
			var visible = $(this).is(':visible');
			var immediate = visible && reflow != undefined
			if (!reflow || visible) {
				var cb = $(this).data('reflowVisible');
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
				$(this).removeData('reflowVisible');
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
	
})(window.jQuery);

var PB = {
	fn: {}
};

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

// Helper for measuring hidden dimensions
// briefly shows all the hidden parents of the element
// Usage:
// var hide = new PB.fn.HiddenDimensions(el)
// http://devblog.foliotek.com/2009/12/07/getting-the-width-of-a-hidden-element-with-jquery-using-width/
PB.fn.ShowForMeasure = function(el) {
	this.el = $(el);
};

PB.fn.ShowForMeasure.prototype = {
	props:  { position: 'absolute', visibility: 'hidden', display: 'block' },
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

// Event listener mixin
PB.fn.EventListener = function(eventList) {
	this.listeners = {};
	var that = this;
	eventList.split(' ').forEach( function(val, index, arr) {
		that.listeners[val] = [];
	});
};

$.extend(PB.fn.EventListener.prototype, {
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
		this.images = [];
		this.pages = [];
		for (var i = 0; i < json.pages.length; i++)
			this.pages.push(new PB.fn.BookPage(json.pages[i]));
	}
	else {
		this.id = 0;
		this.title = "";
		this.images = [];
		this.pages = [];
	}
	$.extend(this, new PB.fn.EventListener("imageAdded imageRemoved pageAdded"));
};

// Book represents the photo book
// Look at constructor for the list of events
$.extend(PB.fn.Book.prototype, {
	
	addLocalFileImage: function (file) {
		for (var i=0; i< this.images.length; i++)
			if (this.images[i].name() == file.fileName) 
			{
				PB.UI.notice(file.fileName + " is already in the book.");
				return;
			};

		var image = new PB.fn.ImageBroker(file);
		var pos = this.images.push(image);
		this.send('imageAdded', image, pos);
	}
});

// ImageBrooker
PB.fn.ImageBroker = function(file) {
	this.file = file;
	this.img = null;
}

$.extend(PB.fn.ImageBroker.prototype, {

	file: null, // on-disk file

	img: null, // img tag holding the image
	error: null,
	
	name: function() {
		return this.file.fileName;
	},
	
	toCanvasFinalize: function(deferred, options) {
		if (this.error != null) {
			console.log(this.name() + " failed to load");
			return deferred.rejectWith(document, [this]);
		}
		console.log(this.name() + " loaded");
		// Resize image to canvas
		var scale = options.desiredHeight / this.img.naturalHeight;
		if (scale > 1)
			scale = 1;
		var canvasWidth = Math.round(this.img.naturalWidth * scale);
		var canvasHeight = options.desiredHeight;
		var img = this.img;
		var canvas = $("<canvas />")
			.attr('width', canvasWidth)
			.attr('height', canvasHeight)
			.each(function(index, el) {
				el.getContext('2d').drawImage(img, 0,0, canvasWidth, canvasHeight);
			}).get(0);
		// Complete callback
		deferred.resolveWith(document, [canvas, this]);
		// Clean up
		this.clearImg();
	},
	
	// Copies image to canvas
	// Returns a deferred. done and fail will get (canvas, img) callbacks
	toCanvas: function(options) {
		var deferred = new $.Deferred();
		$.extend({
			desiredHeight: 128
		}, options);
		
		if (this.img && $(this.img).data('loaded'))
			toCanvasFinalize(deferred, options);
		else {
			var THIS = this;
			this.img = new Image();
			$(this.img).bind({
				load : function() {
					$(THIS.img).data('loaded', true);
					deferred.imageSize = 4 * THIS.img.width * THIS.img.height;
					THIS.toCanvasFinalize(deferred, options);
//					console.log("Loaded: " + THIS.name());
				},
				error : function(e) {
					$(THIS.img).data('loaded', true);
					THIS.error = "Image could not be loaded";
					THIS.toCanvasFinalize(deferred, options);
				},
				abort: function(e) {
					$(THIS.img).data('loaded', true);
					THIS.error = "Image loading was aborted";
					THIS.toCanvasFinalize(deferred, options);
				}
			});
			PB.ImageLoadQueue.push(deferred, function() {
//				console.log("Started: " + THIS.name());
				THIS.img.src = window.URL.createObjectURL(THIS.file);				
			});
		};
		return deferred;
	},
	
	clearImg:function() {
		if (this.img == null)
		 	return;
		$(this.img).unbind(); // no error callbacks
		this.img.src = "";
		window.URL.revokeObjectURL(this.img.src);
		this.img = null;
	}

});

PB.fn.BookPage = function(json) {
	$.extend(this, json);
}

$.extend(PB.fn.BookPage.prototype, {
	toCanvas: function(options) {
		$.extend({
			desiredHeight: 128
		}, options);
		var height = parseFloat(this.height);
		var width = parseFloat(this.width);
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
});

// Image loading queue
// Limits how many images:
// - can be downloaded simultaneusly
// - can be downloaded in a 10 second window. This is to prevent
//   memory trashing, FF keeps all images in used memory for 10 seconds, 
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
		this.imageSize = 0;
	},
	push: function(deferred, fn) {
		this.waiting.push([deferred, fn]);
		this.process();
	},
	execute: function(deferred, fn) {
		this.active.push(new this.activeObject(deferred));
		var THIS = this;
		deferred.done(function() {
			// Mark job as inactive
			for (var i=0; i< THIS.active.length; i++)
				if (THIS.active[i].deferred == deferred) {
					THIS.active[i].live = false;
					if ('imageSize' in deferred)
						THIS.active[i].imageSize = deferred.imageSize;
			}
			THIS.timer.imagesLoaded += 1;
			THIS.process(); // Process any new jobs
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
				imageCacheSize += this.active[i].imageSize;
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
			var THIS = this;
			window.setTimeout(function() {
				THIS.process();
			}, 1000);
		}
//		this.timer.end("LIQ::process, images " + this.timer.imagesLoaded + " executed in ");
	}
};
