"use strict";
//
// PB global functions
//
$.extend(PB, new PB.EventBroadcaster("docLoaded"));

$.extend(PB, {
	_init: $(document).ready(function() { PB.init() }),

	// Load the book on startup
	init: function () {
		var match = window.location.pathname.match(/editor\/(\d+)/);
		if (match != null)
			this.load(match[1]);
	},

	book: function() {
		return this._book;
	},
	
	// Call when files are dropped or added
	handleFiles: function (files) {
		for (var i=0; i<files.length; i++) {
			this._book.addLocalFileImage(files.item(i));
		}
	},
	
	// Loads the book
	load: function(id) {
		$("#main-container").html("<h1>Loading...</h1>");
		var self = this;
		$.ajax({url: "/books/" + id})
			.success( function(json, status, jqXHR) {
					try {
						self._book=  new PB.Book(json);
					}
					catch(e) {
						console.error("Unexpected error creating book from JSON" + e);
					}
					PB.UI.bookLoaded(self._book);
			})
			.error( function(jqXHR, textStatus, errorThrown) {
				PB.error("Unexpected network error loading book." + textStatus);
			});
	},
	// The "stop this event" pattern
	stopEvent: function(e) {
		e.stopPropagation();
		e.preventDefault();		
	}
});

PB.UI = {
		
	_init: $(document).ready(function() { PB.UI.init() } ),
	
	init: function() {
		$(document).bind('drop dragover dragenter dragleave', PB.stopEvent);
		$(window).resize(function(e) {
			PB.UI.MainContainer.resize();
		});
		$(window).resize(); // trigger reflow
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
			PB.UI.Phototab.imageAdded(images[i], i, true);
		var pages = book.pages();
		for (var i=0; i < pages.length; i++)
			PB.UI.Pagetab.pageAdded(pages[i], i, true);
//		$('#header nav a[href="#pages-tab"]').click();

		// Display 1st page
		if (book.firstPage() == null)
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
//					console.log("dragenter" + e.currentTarget);
					$("#photos-tab").addClass('drop-feedback');
					PB.stopEvent(e);	
				},
				'dragleave': function(e) {
//					console.log("dragleave" + e.currentTarget);
					$("#photos-tab").removeClass('drop-feedback');
					PB.stopEvent(e);			
				},
				'drop': function(e) {
//					console.log("drop" + e.currentTarget);
					$("#photos-tab").removeClass('drop-feedback');
					PB.handleFiles(e.originalEvent.dataTransfer.files);			
				},
				'dragover': function(e) {
//					console.log("dragover" + e.currentTarget);
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
		$("#photo-list").revealByMarginLeft("div:nth-child(" + n+ ")");
	},
	
	restyleSlider: function() {
		var hsize = 20;
		var vsize = 16;
		var allPhotos = $("#photo-list canvas");
		if (allPhotos.size() == 0) {
			$("#photo-list-slider").hide();
			return;
		}
		var thumbWidth = 25;
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

	addNewCanvas: function(canvas, img, noScroll) {
		var canvasWidth = canvas.width;	// Once appended, width becomes 0 when hidden
		canvas = $(canvas);
		var enclosingDiv = $("<div></div>").appendTo('#photo-list');
		canvas.appendTo(enclosingDiv);
		enclosingDiv.width(canvasWidth);
		canvas.draggable({ 
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
			var allPhotos = $("#photo-list div");
			var newWidth = allPhotos
				.map(function() {return $(this).outerWidth()})
				.get()
				.reduce( function(sum, prop) { return sum + prop;});
			$("#photo-list").css("width", newWidth+"px");
			
			// Resize the slider
			$("#photo-list-slider").slider("option", {
				min: 0,
				max: allPhotos.size() - 1,
				value: noScroll ? 0 : Math.max(allPhotos.size() - 2, 0)
			});
				
			PB.UI.Phototab.restyleSlider();
			$("#photo-list-slider").show();
			PB.UI.MainContainer.resize();
		});
	},
	
	imageAdded: function(pbimage, index, noScroll) {
		var self = this;
		pbimage.toCanvas( { desiredHeight : 128 } )
			.done( function(canvas, img) {
				$("#photos-tab .intro").hide();
				self.addNewCanvas(canvas, img, noScroll);
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
	selectPage: function(page_id) {
		var self = this;
		$('#page-list canvas').each(function() {
			var c = $(this);
			if (c.data('book_page_id') == page_id) {
				if (c.hasClass('selected'))
					return;
				else {
					c.addClass('selected');
					PB.UI.Bookpage.setCurrentPage(page_id);
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
	pageAdded: function(page, index, noScroll) {
		$("#pages-tab .intro").hide();
		// add new page
		var canvas = $(page.toCanvas( { desiredHeight: 64 }));
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
				value: noScroll ? 0 : Math.max(allPages.size() - 2, 0)
			});
			var thumbWidth = 25;
			var maxWidth = $("#page-list-container").width() - thumbWidth;
			var sliderWidth = Math.min(maxWidth, allPages.size() * 20);
			$("#page-list-slider").css("width", sliderWidth).show();
		});
	}
}

/* Page in a book
 * Main page element contains data:
 * page-id, dirty, and class "page"
 *
 * DOM structure:
 * #main-container
 *   div.page-enclosure
 * 		 div.book-page  data:page_id data:dirty
 *       
 */
PB.UI.Bookpage = {
	// makes element accept images on drop
	makeDroppable: function(el) {
		$(el).droppable({
			  	'hoverClass': "drop-feedback",
			  	'activeClass': 'drop-feedback',
			  	'drop': function(event, ui) {
			  		// when image drops, replace drop element with an image of the same size
			  		var imageBroker = $(ui.draggable).data('imageBroker');
			  		try {
				  		var image = $('<img style="visibility:hidden"/>');
				  		image.addClass("actual-image");
				  	  image.bind("load",  function(ev) {
									PB.UI.Bookpage.imageLoaded(this, ev);
									image.css("visibility", "visible");
							});
				  		$(this).children().remove();
				  		$(this).append(image);
							$(this).parents('.page-enclosure')
								.data("page").setModified();
				  		image.attr('src', imageBroker.getImageUrl('display'));
				  	}
				  	catch(ex)
				  	{
				  		console.error(ex.message);
				  	}
			  }});
	},
	// Loads page from model
	createPageElement: function(page_id) {
		var page = PB.book().getPageById(page_id);
		var el = $(page.html());
		el.addClass("book-page");
		el.find(".book-image").each( function() {
				PB.UI.Bookpage.makeDroppable(this);
			});
		var enclosingDiv = $("<div></div>")
			.addClass('page-enclosure')
			.css("position", "relative")
			.css("width", el.css('width'))
			.css("height", el.css('height'))
			.data('page_id', page_id)
			.data('page', page)
		enclosingDiv.append(el);
		page.setDisplayDom(enclosingDiv);
		return enclosingDiv;
	},
	
	setCurrentPage: function(page_id) {
		// save the old page if possible
		$("#main-container div.page-enclosure").each(function() {
			$(this).data("page").saveNow().setDisplayDom(null);
		});
		var dom = this.createPageElement(page_id);
		dom.appendTo($("#main-container").empty());
		PB.UI.MainContainer.fitContent();
	},
	
	imageLoaded: function(img, event) { 
		var parent = $(img).parent();
		var pwidth = parent.width();
		var pheight = parent.height();
		var iwidth = img.naturalWidth;
		var iheight = img.naturalHeight;
		var vscale = pheight / iheight;
		var hscale = pwidth / iwidth;
		var scale = Math.min(vscale, hscale);
		var align = $(img).parent().attr('data-align') || 'center';
		var x = 0, y=0;
		switch(align) {
			case 'top':
			case 'start':
				break;
			case 'center':
				x = (pwidth - iwidth * scale) / 2;
				y = (pheight - iheight * scale) / 2;
				break;
			case 'bottom':
			case 'right':
			case 'end':
				x = pwidth - iwidth * scale;
				y = pheight - iheight * scale;
				break;
			default:
				console.warn("Unknown image data-align attribute: " + align);
		}
		img.style.position = 'relative';
		img.style.height = iheight * scale + "px";
		img.style.width = iwidth * scale + "px";
		img.style.top = y + "px";
		img.style.left = x + "px"; 
	}
}

PB.UI.MainContainer = {
	get mainEl() {
		if (!("_mainEl" in this))
			this._mainEl = $("#main-container");
		return this._mainEl;
	},
	resize: function() {
		var newHeight = Math.floor(window.innerHeight - this.mainEl.offset().top - 3);
		// As a precaution, we call resize a lot, so it is good to optimize it out if not needed
		if ((newHeight + "px"  == this.mainEl.css("height")))
			return;
		$("#main-container").css("height", newHeight + "px");
		this.fitContent();
	},
	fitContent: function() {
		var page = $("#main-container .book-page");
		if (!page) return;
		
		var pad = 20;
		var mainHeight = parseInt($("#main-container").get(0).style.height) - pad;
		var mainWidth =  $("#main-container").parent().width() - pad;

		var pageWidth =  page.width();
		var pageHeight = page.height();

		var vscale = mainHeight / pageHeight;
		var hscale = mainWidth / pageWidth;
		var scale = Math.min(vscale, hscale);

		if (this._fitStyle == 'full')
			scale = 1;
		page.parent().mozcss("transform", "scale("+scale+")")
			.css("left", (mainWidth - pageWidth ) / 2 + (pad / 2) + "px")
			.css("top", (mainHeight - pageHeight) / 2 + (pad / 2) + "px");
	}
}

