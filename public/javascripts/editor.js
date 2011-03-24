"use strict"

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

PB.fn.Book = function() {
	this.images = [];
	this.pages = [];
	$.extend(this, new PB.fn.EventListener("imageAdded imageRemoved"));
};

// all events are based off book
$.extend(PB.fn.Book.prototype, {
	
	addLocalFileImage: function (file) {
		this.images.forEach(function(image) {
			if (image.name == file.name) {
				PB.UI.notice("Image " + file.name + " was already in the photo book.");
				return;
			}
		});
		var image = new PB.fn.BookImage(file);
		var pos = this.images.push(image);
		this.send('imageAdded', image, pos);
	}
});

// Photobook image class
PB.fn.BookImage = function(file) {
	this.file = file;
	this.img = null;
}

$.extend(PB.fn.BookImage.prototype, {

	file: null, // on-disk file

	img: null, // img tag holding the image
	error: null,
	
	name: function() {
		return this.file.name;
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
		window.URL.revokeObjectURL(this.img.src);
		this.img.src = "";
		this.img = null;
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

//
// PB global functions
//
$.extend(PB, new PB.fn.EventListener("docLoaded"));

$.extend(PB, {
	_init: $(document).ready(function() { PB.init() }),
	init: function () {
		this._book = new PB.fn.Book();
	},

	book: function() {
		return this._book;
	},
	
	handleFiles: function (files) {
		for (var i=0; i<files.length; i++) {
			this._book.addLocalFileImage(files.item(i));
		}
	},
	
	load: function(id) {
		$.ajax({url: "/books/" + id});
		PB.UI.notice("Loading book");
	},
	stopEvent: function(e) {
		e.stopPropagation();
		e.preventDefault();		
	}
});

PB.UI = {
		
	_init: $(document).ready(function() { PB.UI.init() } ),
	
	init: function() {
		PB.UI.initNavTabs();
		$(document).bind('drop dragover dragenter dragleave', PB.stopEvent);
		$(window).resize(function(e) {
			var newHeight = $(window).height() - $("#header").outerHeight();
			$("#main-container").css("height", newHeight + "px");
		});
		$(window).resize(); // trigger reflow
	},
	
	initNavTabs: function() {
		$("#nav-tabs").addClass('ui-corner-all');
		$("#header nav a").each(function(i, el) {	// all nav anchors
			$(this).addClass("ui-corner-left ui-widget ui-state-default"); // setup class styling
			var tab = $("#" + el.href.split('#')[1]);
			tab.addClass("header-tab ui-corner-all");
			$(this).click(function() { // and click handler
				$(this).parent().children().each(function(j, anchor) { // traverse all anchors
					var tab = $("#" + anchor.href.split('#')[1]);
					if (el == anchor) { // make clicked element active 
						$(anchor).addClass("ui-state-active").removeClass("ui-state-default");
						tab.show();
					}
					else { // deactivate the rest
						$(anchor).addClass("ui-state-default").removeClass("ui-state-active");
						tab.hide();
					}
				});
				return false;
			});
		});
		// move tab panes to the right of tabs
		var style = window.getComputedStyle($('#header > nav').get(0));
		var width = parseFloat(style.getPropertyValue("width"))
			+ parseFloat(style.getPropertyValue("margin-left"))
			+ parseFloat(style.getPropertyValue("border-left-width"))
			+ parseFloat(style.getPropertyValue("padding-left"));
		$("#nav-tabs").css("margin-left", Math.floor(width-2) + "px");
		// select first anchor
		$("#header nav a").first().click();
	},
	
	notice: function(text) {
		const icon = '<span class="ui-icon ui-icon-info" style="float: left; margin-right: .3em;margin-top:.3em"></span>';
		$('#error').hide();
		$('#notice').html(icon + text).show('blind');
	},

	error: function(text) {
		const icon = '<span class="ui-icon ui-icon-alert" style="float: left; margin: 0.3em 0.3em 0em .2em"></span>';
		$('#notice').hide();
		$('#error').html(icon + text).show('blind');
	}

};


PB.UI.Phototab = {
	_init: $(document).ready(function() { PB.UI.Phototab.init() }),
	init: function() {
		var imageTabDragEvents = {
				'dragenter': function(e) {
		//			console.log("dragenter" + e.currentTarget);
					$("#photos-tab").addClass('drop-feedback');
					PB.stopEvent(e);	
				},
				'dragleave': function(e) {
		//			console.log("dragleave" + e.currentTarget);
					$("#photos-tab").removeClass('drop-feedback');
					PB.stopEvent(e);			
				},
				'drop': function(e) {
		//			console.log("drop" + e.currentTarget);
					$("#photos-tab").removeClass('drop-feedback');
					PB.handleFiles(e.originalEvent.dataTransfer.files);			
				},
				'dragover': function(e) {
					$("#photos-tab").addClass('drop-feedback');
					PB.stopEvent(e);
				}
		};
		// accept dragged images
		$("#photos-tab").bind(imageTabDragEvents);
		PB.book().bind('imageAdded', function(image, index) {
			PB.UI.Phototab.imageAdded(image, index);
		});

		// click to select files
		$("#photos-tab").click(function(e) {
			$("#file-dialog").click();
			e.stopPropagation();
		});
		$("#file-dialog").click(function(e) {
			e.stopPropagation();
		});
		$("#file-dialog").change(function(e) {
			PB.stopEvent(e);
			PB.handleFiles(this.files);
		});
		// slider initialization
		$( "#photo-list-slider" ).slider({
			change: function(e, ui) {
				PB.UI.Phototab.revealNthImage(ui.value + 1);				
			},
			slide: function(e, ui) {
				PB.UI.Phototab.revealNthImage(ui.value + 1);
			}
		});
		$(window).resize(this.restyleSlider);
	},
	
	revealNthImage: function(n) {
		var canvasSel = "#photo-list canvas:nth-child(" + n+ ")";
		this.revealImage( $(canvasSel).get(0));				
	},
	
	revealImage: function(canvas) {
		if (!canvas)
			return;
		var lastCanvas = $("#photo-list canvas:last");
		// Find the rightmost canvas edge
		var rightmostCanvasEdge = $(lastCanvas).position().left + Math.abs(parseInt($("#photo-list").css("margin-left")));
		var style = window.getComputedStyle(lastCanvas.get(0));
		$.each(['width','border-left-width', 'border-right-width', 'padding-left', 'padding-right'], 
			function(i,key) {
				rightmostCanvasEdge += parseFloat(style.getPropertyValue(key));
			});
		// Limit scrolling to now show empty space on the right
		var leftLimit = rightmostCanvasEdge - $('#photo-list-container').width();
		leftLimit = Math.max(0, leftLimit);
		
		var left = $(canvas).position().left + Math.abs(parseInt($("#photo-list").css("margin-left")));
		if (left > leftLimit)
			left = leftLimit;
		$("#photo-list").clearQueue().animate({ 
			"margin-left": "-" + Math.abs(left) + "px"
			}, {
				duration: 200
			});
	},
	
	restyleSlider: function() {
		var hsize = 20;
		const vsize = 16;
		var allPhotos = $("#photo-list canvas");
		var maxWidth = $("#photo-list-container").width();
		var naturalSize = allPhotos.size() * hsize;
		if (naturalSize > maxWidth)
		{
			naturalSize = maxWidth;
			hsize = maxWidth / allPhotos.size();
		}
		var canvas = $("<canvas />")
			.attr('width', allPhotos.length * hsize)
			.attr('height', vsize).get(0);
		var c2d = canvas.getContext('2d');
		allPhotos.each(function(index, el) {
			c2d.drawImage(el, index * hsize, 0, hsize, vsize);
		});
		$("#photo-list-slider").css("background-image", "url(" + canvas.toDataURL() + ")");
		$("#photo-list-slider").css("width", allPhotos.length * hsize);
	},

	addNewCanvas: function(canvas, img) {
		$(canvas).draggable({ "containment": "body"}).appendTo('#photo-list');
		// Resize the container to fit the images
		var newWidth = 0;
		var allPhotos = $("#photo-list canvas");
		allPhotos.each( function(index, el) {
			var style = window.getComputedStyle(el);
			newWidth += ['width', 'margin-left', 'margin-right', 
				'border-left-width', 'border-right-width', 
				'padding-left', 'padding-right']
				.reduce(function(sum, prop) {
					return sum + parseFloat(style.getPropertyValue(prop));
				}, 0);
			});
		$("#photo-list").css("width", newWidth+"px");
		// Resize the slider
		$("#photo-list-slider").slider("option", {
			min: 0,
			max: allPhotos.size() - 1,
			value: Math.max(allPhotos.size() - 2, 0)
		});
		PB.UI.Phototab.restyleSlider();
		$("#photo-list-slider").show();
		img.clearImg();
	},
	
	imageAdded: function(pbimage, index) {
		var THIS = this;
		pbimage.toCanvas( { desiredHeight : 128 } )
			.done( function(canvas, img) {
				$("#photos-tab .intro").hide();
				THIS.addNewCanvas(canvas, img);
			})
			.fail( function(img) {
				alert("Could not load image " + img.name());
			});
	},
	
	imageRemoved: function(pbimage, index) {
		// TODO
	}
}

//
// Responding to ajax requests
//
PB.Ajax = {
	_init: $(document).ready(function() { PB.Ajax.init()}),
	init: function() {
		$('form[data-remote]').live('submit', function(event) {
			$.ajax({
				url: this.action,
				type: this.method,
				data: $(this).serialize()
			});
			event.preventDefault();
		});
		$(document).ajaxComplete(PB.Ajax.ajaxComplete);
	},
	ajaxComplete: function(event, jqXHR, ajaxOptions) {
		var msg = jqXHR.getResponseHeader('X-FlashError``');
		if (msg) PB.UI.error(msg);
		var msg = jqXHR.getResponseHeader('X-FlashNotice');
		if (msg) PB.UI.notice(msg);
		
		var contentType = jqXHR.getResponseHeader("Content-Type");
		try {
			if (contentType.match("text/html")) {
				// All HTML returned is a single div
				// It replaces content of main-container, unless data-destination is specified
				var destination = "main-container";
				$("#" + destination).html(jqXHR.responseText);
			}
			else if (contentType.match("application/json")) {
				var json = $.parseJSON(jqXHR.responseText);
				
				if (ajaxOptions.url.match("/books$") && ajaxOptions.type == "POST")
				{
					PB.load(json.id);
				}
			}
		}
		catch(e) {
			alert("Unexpected ajaxComplete error " + e);
		}
	}
}

$(document).ready(function() {
	$.get("/books/new");
});

