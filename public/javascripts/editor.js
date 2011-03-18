"strict"

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
	send: function(eventType, arg) {
		if (!eventType in this.listeners)
			throw "unknown event type " + eventType;
		this.listeners[eventType].forEach(function(val) {
			val.call(arg);
		});
	}
});

$.extend(PB, {
	init: function () {
		this.doc = PB.fn.Document();
		PB.UI.init();
	},
	
	handleFiles: function (files) {
		for (var i=0; i<files.length; i++)
			PB.ImageList.add(files.item(i));
	},
	
	load: function(id) {
		// loads the photo book document
		alert(id);
	}
});
$.extend(PB, new EventListener("docLoaded"));

PB.UI = {};

$.extend(PB.UI, {
	
	stopEvent: function(e) {
		e.stopPropagation();
		e.preventDefault();		
	},
	
	initSetup: $(document).ready(function() { PB.UI.init() }),
	
	init: function() {
		PB.UI.initNavTabs();
		$(document).bind('drop dragover dragenter dragleave', PB.UI.stopEvent);
		$(window).resize(function(e) {
			var newHeight = $(window).height() - $("#header").outerHeight();
			$("#main-container").css("height", newHeight + "px");
		});
		$(window).resize(); // trigger reflow
		$(document).ajaxComplete(PB.UI.reportAjaxMessages);
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
	},

	reportAjaxMessages: function(event, request) {
		var msg = request.getResponseHeader('X-FlashError``');
		if (msg) PB.UI.error(msg);
		var msg = request.getResponseHeader('X-FlashNotice');
		if (msg) PB.UI.notice(msg);		
	}
});


PB.UI.Phototab = {
	init: function() {
		var imageTabDragEvents = {
				'dragenter': function(e) {
		//			console.log("dragenter" + e.currentTarget);
					$("#photos-tab").addClass('drop-feedback');
					PB.UI.stopEvent(e);	
				},
				'dragleave': function(e) {
		//			console.log("dragleave" + e.currentTarget);
					$("#photos-tab").removeClass('drop-feedback');
					PB.UI.stopEvent(e);			
				},
				'drop': function(e) {
		//			console.log("drop" + e.currentTarget);
					$("#photos-tab").removeClass('drop-feedback');
					PB.handleFiles(e.originalEvent.dataTransfer.files);			
				},
				'dragover': function(e) {
					$("#photos-tab").addClass('drop-feedback');
					PB.UI.stopEvent(e);
				}
		};
		// accept dragged images
		$("#photos-tab").bind(imageTabDragEvents);
		PB.ImageList.bind(PB.UI.Phototab);

		// click to select files
		$("#photos-tab").click(function(e) {
			$("#file-dialog").click();
			e.stopPropagation();
		});
		$("#file-dialog").click(function(e) {
			e.stopPropagation();
		});
		$("#file-dialog").change(function(e) {
			PB.UI.stopEvent(e);
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
		c2d = canvas.getContext('2d');
		allPhotos.each(function(index, el) {
			c2d.drawImage(el, index * hsize, 0, hsize, vsize);
		});
		$("#photo-list-slider").css("background-image", "url(" + canvas.toDataURL() + ")");
		$("#photo-list-slider").css("width", allPhotos.length * hsize);
	},

	imageAdded: function(pbimage, index) {
		pbimage.toCanvas({
			desiredHeight: 128,
			callback: function(canvas, img) {
				$(canvas).draggable({ "containment": "body"}).appendTo('#photo-list');
				
				$("#photos-tab .intro").hide();
				// Resize the container to fit the images
				var newWidth = 0;
				var allPhotos = $("#photo-list canvas");
				allPhotos.each( function(index, el) {
					var style = window.getComputedStyle(el);
					$.each(['width', 'margin-left', 'margin-right', 'border-left-width',
					 				'border-right-width', 'padding-left', 'padding-right',], 
						function(i,key) {
							newWidth += parseFloat(style.getPropertyValue(key));
						});
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
				pbimage.clearImg();
			}
		});
	},
	
	imageRemoved: function(pbimage, index) {
		// TODO
	}
}

$(document).ready(PB.UI.Phototab.init);

PB.LoadImageQueue = {

	queue: [],
	active: 0,
	timer: null,
	timedTotal: 0,
	
	push: function(fn) {
		if (this.timer == null) {
			this.timer = new Timer("Image loader " + Date.now());
			this.timedTotal = 0;
		}
		this.queue.push(fn);
		window.setTimeout(function() {
			// Delay execution because ui interactions during drop event causes bugs
			PB.LoadImageQueue.process();			
		});
	},

	functionDone: function() {
		this.active -= 1;
		this.process();
	},
	
	process: function() {
		if (this.queue.length == 0) {
			this.timer.end(" " + this.timedTotal + " image loaded in ");
			this.timer = null;
		}
		if (this.active > 0 || this.queue.length == 0)
			return;
		var fn = this.queue.shift();
		this.timedTotal += 1;
		this.active += 1;
		// Rate-limit how fast the queue can fire
		// 40MB image loads in 1/3s
		// Firefox clears its cache after 10s, our mem usage goes up to 1.5G, causing trashing
		// TODO, measure memory usage in the last 10 seconds, and rate-limit on 400MB
		window.setTimeout(fn, 400);
	}

};

var PB.fn.Book = function() {
	this.images = [];
	this.pages = [];
	$.extend(this, new EventListener("imageAdded imageRemoved"));
};

// all events are based off book
$.extend(PB.fn.Book.prototype, {
	title: "",
});

// Photobook image class
PB.fn.Image = function(file) {
	this.file = file;
	this.img = null;
}

$.extend(PB.fn.Image.prototype, {

	file: null, // on-disk file

	img: null, // img tag holding the image
	
	name: function() {
		return this.file.name;
	},
	
	toCanvasFinalize: function(options) {
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
		options.callback(canvas, this);
		// Clean up
		this.clearImg();
	},
	
	toCanvas: function(options) {
		var defaults = {
			desiredHeight: 128,
			callback: function(canvas) { console.log("No toCanvas callback") },
			error: function(msg) { console.log("No toCanvas error callback")}
		};
		$.extend(defaults, options);
		if (this.img && $(this.img).data('loaded'))
			toCanvasFinalize(options);
		else {
			var pbimage = this;
			PB.LoadImageQueue.push(function() {
				pbimage.img = document.createElement("img");
				pbimage.img.onload = function() {
					try {
						$(pbimage.img).data('loaded', true);
						pbimage.toCanvasFinalize(options);
					}
					finally {
						PB.LoadImageQueue.functionDone();
					}
				}
				pbimage.img.src = window.URL.createObjectURL(pbimage.file);				
			});
		}
	},
	
	clearImg:function() {
		if (this.img == null)
		 	return;
		window.URL.revokeObjectURL(this.img.src);
		this.img = null;
	}

});

PB.ImageList = {
	
	images: [],	// Array of PB.Image
	
	listeners: [],
	
	add: function(file) {
		// Do not import duplicate file names
		this.images.forEach(function(image) {
			if (image.name == file.name) {
				PB.UI.notice("Image " + file.name + " was already in the photo book.");
				return;
			}
		});

		var image = new PB.fn.Image(file);
		var pos = this.images.push(image);
		
		this.listeners.forEach(function(listener) {	// broadcast addition
			listener.imageAdded(image, pos);
		});
	},

	remove: function() {	// TODOs
	},

	bind: function(listener) {
		this.listeners.push(listener);
		return listener;
	},

	unbind: function(handler) {
		var i = this.listeners.indexof(handler);
		if (i != -1)
			this.listeners.splice(i, 1);
	}
};
