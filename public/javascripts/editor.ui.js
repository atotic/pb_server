//
// PB global functions
//
$.extend(PB, new PB.fn.EventBroadcaster("docLoaded"));

$.extend(PB, {
	_init: $(document).ready(function() { PB.init() }),
	init: function () {
		var match = window.location.pathname.match(/editor\/(\d+)/);
		if (match != null)
			this.load(match[1]);
		else {
			this._book = new PB.fn.Book();
			PB.UI.bookLoaded(this._book);
		}
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
		$("#main-container").html("<h1>Loading...</h1>");
		var self = this;
		$.ajax({url: "/books/" + id}).then(
			function(json, status, jqXHR) {
				try {
					var oldBook = self._book;
					self._book=  new PB.fn.Book(json);
					if (oldBook && oldBook.id == 0)	// transfer the images dropped before
					{
						var images = oldBook.images();
						for (var i =0; i< images.length; i++)
							self._book.addLocalFileImage(images[i].file);
					}
				}
				catch(e) {
					alert("Unexpected ajaxComplete error " + e);
				}
				PB.UI.bookLoaded(self._book);
		});
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
						tab.reflowVisible();
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

	bookLoaded: function(book) {
		document.title = "Photobook: " + book.title;
		// Bind the event handlers
		book.bind('imageAdded', function(image, index) {
			PB.UI.Phototab.imageAdded(image, index);
		});
		book.bind('pageAdded', function(page, index) {
			PB.UI.Pagetab.pageAdded(page, index);
		});
		// Load in the document data
		PB.UI.Phototab.clear();
		var images = book.images();
		for (var i=0; i < images.length; i++)
			PB.UI.Phototab.imageAdded(images[i], i);
		var pages = book.pages();
		for (var i=0; i < pages.length; i++)
			PB.UI.Pagetab.pageAdded(pages[i], i);
//		$('#header nav a[href="#pages-tab"]').click();
		// Display 1st page
		if (pages.length == 0)
		{
			if (book.id ==0)
				$.get("/books/new");
			else
				$("#main-container").html("<h1>Book is empty</h1>");
		}
		else
			PB.UI.Pagetab.selectPage(book.firstPage().id);
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

		// click to select files
/*		$("#photos-tab").click(function(e) {
			$("#file-dialog").click();
			e.stopPropagation();
		});*/
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
	
	clear: function() {
		$("#photo-list canvas").detach();
		this.restyleSlider();
	},
	
	revealNthImage: function(n) {
		$("#photo-list").revealByMarginLeft("canvas:nth-child(" + n+ ")");
	},
	
	restyleSlider: function() {
		var hsize = 20;
		const vsize = 16;
		var allPhotos = $("#photo-list canvas");
		if (allPhotos.size() == 0) {
			$("#photo-list-slider").hide();
			return;
		}
		const thumbWidth = 25;
		var maxWidth = $("#photo-list-container").width() - thumbWidth;
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
		if (hsize < 1 || vsize < 1)
			debu
		allPhotos.each(function(index, el) {
			c2d.drawImage(el, index * hsize, 0, hsize, vsize);
		});
		$("#photo-list-slider").css("background-image", "url(" + canvas.toDataURL() + ")");
		$("#photo-list-slider").css("width", naturalSize);
	},

	addNewCanvas: function(canvas, img) {
		$(canvas).appendTo('#photo-list')
			.draggable({ 
				'appendTo': 'body',
				'containment': 'window',
				'opacity': 0.7,
				'revert': 'invalid',
				'revertDuration': 200,
				'helper': function(ev) {
					var copy = $(this).clone(false).get(0);
					copy.getContext('2d').drawImage(this, 0,0); // canvas content is not cloned
					var div = $("<div style='background-color:green'></div>");
					$(copy).appendTo(div);
					return div;
				}
		});
		// reflow when element is visible
		$('#photos-tab').reflowVisible(function(immediate) {
			// Resize the container to fit the images
			var allPhotos = $("#photo-list canvas");
			var newWidth = allPhotos
				.map(function() {return $(this).outerWidth()})
				.get()
				.reduce( function(sum, prop) { return sum + prop;});
			$("#photo-list").css("width", newWidth+"px");
			
			// Resize the slider
			$("#photo-list-slider").slider("option", {
				min: 0,
				max: allPhotos.size() - 1,
				value: Math.max(allPhotos.size() - 2, 0)
			});
			PB.UI.Phototab.restyleSlider();
			$("#photo-list-slider").show();
		});
//		img.clearImg();
	},
	
	imageAdded: function(pbimage, index) {
		var self = this;
		pbimage.toCanvas( { desiredHeight : 128 } )
			.done( function(canvas, img) {
				$("#photos-tab .intro").hide();
				self.addNewCanvas(canvas, img);
			})
			.fail( function(img) {
				alert("Could not load image " + img.name());
			});
	},
	
	imageRemoved: function(pbimage, index) {
		// TODO
	}
}

PB.UI.Pagetab = {
	_init: $(document).ready(function() { PB.UI.Pagetab.init() }),
	init: function() {
		$( "#page-list-slider" ).slider({
				change: function(e, ui) {
					PB.UI.Pagetab.revealNthPage(ui.value + 1);				
				},
				slide: function(e, ui) {
					PB.UI.Pagetab.revealNthPage(ui.value + 1);
				}
			});		
	},
	createPageElement: function(page_id) {
		var page = PB.book().getPageById(page_id);
		var el = $(page.html());
		var images = el.find(".book_image").wrapSvg();
		images.each( function() {
			  $(this).droppable({
			  	'hoverClass': "drop-feedback",
			  	'activeClass': 'drop-feedback',
			  	'drop': function(event, ui) {
			  		var image_id = $(ui.draggable).data('image_id');
			  		var image = PB.book().getImageById(image_id);
			  		console.log("before");
			  		var svgns = "http://www.w3.org/2000/svg";
			  		var xlns = "http://www.w3.org/1999/xlink";
			  		try {
				  		var svg = document.createElementNS(svgns, 'image');
				  		svg.setAttributeNS(xlns, 'xlink:href', image.getFileUrl());
				  		svg.width.baseVal.value = this.width;
				  		svg.height.baseVal.value = this.height;
				  		svg.x.baseVal.value = this.x;
				  		svg.y.baseVal.value = this.y;
				  		$(this).replaceWith(svg);
				  	}
				  	catch(ex)
				  	{
				  		console.error(ex.message);
				  	}
			  }});
			 });
		return el;
	},
	selectPage: function(page_id) {
		var self = this;
		$('#page-list canvas').each(function() {
			var c = $(this);
			if (c.data('book_page_id') == page_id) {
				if (c.hasClass('selected'))
					return;
				else {
					c.addClass('selected');
					var svg = self.createPageElement(page_id);
					svg.appendTo($("#main-container").empty());
				}
			}
			else {
				if (c.hasClass('selected'))
					c.removeClass('selected');
			}
		});
	},
	revealNthPage: function(n) {
		$("#page-list").revealByMarginLeft("canvas:nth-child(" + n+ ")");		
	},
	pageAdded: function(page, index) {
		$("#pages-tab .intro").hide();
		// add new page
		var canvas = $(page.toCanvas( { desiredHeight: 128 }));
		canvas.data('book_page_id', page.id);
		canvas.click(function(ev) {
			PB.UI.Pagetab.selectPage($(this).data('book_page_id'));
		});
		canvas.appendTo('#page-list');
		// reflow when visible
		$('#pages-tab').reflowVisible(function(immediate) {
			// Resize the container
			var allPages = $('#page-list canvas');
			var newWidth = allPages
				.map(function() {return $(this).outerWidth()})
				.get()
				.reduce( function(sum, prop) { return sum + prop;});
			$('#page-list').css("width", newWidth + "px");
			// Resize the slider
			$("#page-list-slider").slider("option", {
				min: 0,
				max: allPages.size() - 1,
				value: Math.max(allPages.size() - 2, 0)
			});
			const thumbWidth = 25;
			var maxWidth = $("#page-list-container").width() - thumbWidth;
			var sliderWidth = Math.min(maxWidth, allPages.size() * 20);
			$("#page-list-slider").css("width", sliderWidth).show();
		});
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
		$(document).ajaxComplete(PB.Ajax.showFlashMessages)
		$(document).ajaxComplete(PB.Ajax.ajaxComplete);
	},
	showFlashMessages: function(event, jqXHR, ajaxOptions) {
		var msg = jqXHR.getResponseHeader('X-FlashError');
		if (msg) PB.error(msg);
		var msg = jqXHR.getResponseHeader('X-FlashNotice');
		if (msg) PB.notice(msg);
	},
	ajaxComplete: function(event, jqXHR, ajaxOptions) {
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


