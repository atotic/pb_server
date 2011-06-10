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
 *   div.page-enclosure data:page_id data:page(model)
 * 		 div.book-page
 *       
 */
PB.UI.Bookpage = {

	getDomById: function(id) {
		var found = null;
		$(".page-enclosure").each( function(index, el) {
			if ($(el).data("page_id") == id)
				found = el;
		});
		return found;
	},
	// makes element accept images on drop
	makeDroppable: function(el) {
		$(el).droppable({
			  	'hoverClass': "drop-feedback",
			  	'activeClass': 'drop-feedback',
			  	'drop': function(event, ui) {
			  		// when image drops, replace drop element with an image of the same size
			  		var imageBroker = $(ui.draggable).data('imageBroker');
			  		var pageId = $(this).parents(".page-enclosure").data("page_id");
			  		var cmd = new PB.Commands.DropImage(pageId, imageBroker, this);
			  		PB.CommandQueue.execute(cmd);
			  }});
	},
	updateImageControls: function(bookImage) {
		bookImage = $(bookImage);
		var img = bookImage.find(".actual-image");
		if (img.length == 0)
			bookImage.find(".image-button").remove();
		else if (bookImage.find(".image-button").length == 0) {
			PB.Manipulators.createImageButton("move", "move", bookImage, "move");
			PB.Manipulators.createImageButton("pan", "pan", bookImage, "all-scroll");
			PB.Manipulators.createImageButton("zoom", "zoom", bookImage, 'row-resize');
			PB.Manipulators.createImageButton("rotate", "rotate", bookImage, 'nw-resize');
		}
		if (! bookImage.data("hasManipulatorShowHide")) {
			bookImage.data("hasManipulatorShowHide", true);
			var showHideEvents = {
				mouseenter: function(ev) {
					$(ev.currentTarget).find(".image-button").show();
				},
				mouseleave: function(ev) {
					$(ev.currentTarget).find(".image-button").hide();				
				}
			}
			bookImage.bind(showHideEvents);
		}
	}, 
	// Loads page from model
	createPageElement: function(page_id) {
		var page = PB.book().getPageById(page_id);
		var el = $(page.browserHtml());
		el.addClass("book-page");
		var enclosingDiv = $("<div></div>")
			.addClass('page-enclosure')
			.css("position", "relative")
			.css("width", el.css('width'))
			.css("height", el.css('height'))
			.data('page_id', page_id)
			.data('page', page);
		enclosingDiv.append(el);
		el.find(".book-image").each( function() {
		// this must come after we are inside the enclosing div
				PB.UI.Bookpage.makeDroppable(this);
				PB.UI.Bookpage.updateImageControls(this);
			});
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
	
	// Placement string can have following keywords
	// fixed|flex start|center|end rotate
	// fixed|flex determines whether frame is resizeable
	// start|center|end determines positioning in respect to original frame if image is resized
	// rotate|norotate means that box can rotate
	parseImagePlacement: function(imgDiv) {
		var placement = {
			sizing: "flex",
			align: "center",
			rotate: "true",
			align_top: 'center',
			align_left: 'center'
		}
		var attr = imgDiv.attr("data-placement");
		if (attr) {
			var props = attr.split(" ");
			for (var i=0; i<props.length; i++)
				switch(props[i].toLowerCase()) {
					case "flex": placement.sizing = "flex"; break;
					case "fixed": placement.sizing = "fixed"; break;
					case "rotate": placement.rotate = true; break;
					case "norotate": placement.rotate = false; break;
					case "align-top-center": placement.align_top = "center"; break;
					case "align-top-start": placement.align_top = "start"; break;
					case "align-top-end": placement.align_top = "end"; break;
					case "align-left-center": placement.align_left = "center"; break;
					case "align-left-start": placement.align_left = "start"; break;
					case "align-left-end": placement.align_left = "end"; break;
					default: console.warn("Unknown data-placement attribute:", props[i]);
				}
		}
		return placement;
	},
	imageLoaded: function(imgDiv) {
		imgDiv = $(imgDiv);
		var img = imgDiv.find(".actual-image");
		if (img.length != 0) {
			var placement = this.parseImagePlacement(imgDiv);
			// calculate image div width/height, taking rotation into account
			//   image div depends on rotation/flex
			var dWidth = imgDiv.width();
			var dHeight = imgDiv.height();
			var iWidth = img.prop("naturalWidth");
			var iHeight = img.prop("naturalHeight");
			var rotated = false;
		// Determine imageDiv width/height
			// Rotate if needed
			if (placement.rotate) {
				var divOrient = Math.round(dWidth / dHeight * 100) >= 100 ? 'h' : 'v';
				var imgOrient = Math.round(iWidth / iHeight * 100) >= 100 ? 'h' : 'v';
				if (divOrient != imgOrient) {
					var tmp = dWidth;
					dWidth = dHeight;
					dHeight = tmp;
					rotated = true;
					console.log('rotating dWidth:' + dWidth + " dHeight:" + dHeight);
				}
			}
			// Determine size of imageDiv and image.
			var imageHScale = dWidth / iWidth;
			var imageVScale = dHeight / iHeight;
			if (placement.sizing == 'flex') {
				// For flex sizing, image cannot be outside original bounds. imageDiv wraps around the image
				if (imageVScale < imageHScale ) {
					iWidth *= imageVScale;
					iHeight *= imageVScale;
					dHeight = iHeight;
					dWidth = iWidth;
					console.log("flexing, vertical fill iWidth: " + iWidth + " iHeight:" + iHeight + " dHeight:" + dHeight);
				} else {
					iWidth *= imageHScale;
					iHeight *= imageHScale;
					dWidth = iWidth;
					dHeight = iHeight;
					console.log("flexing, horizontal fill iWidth: " + iWidth + " iHeight:" + iHeight + " dHeight:" + dHeight);
				}
			} else {
				// Fixed sizing, smallest image dimension fills div completely
				if (imageVScale < imageHScale) {
					iWidth *= imageHScale;
					iHeight *= imageHScale;
					console.log("fixed, horizontal iWidth: " + iWidth + " iHeight:" + iHeight);
				}
				else {
					iWidth *= imageVScale;
					iHeight *= imageVScale;
					console.log("fixed, vertical iWidth: ",iWidth, " iHeight:", iHeight);
				}
			}
			// All sizes determined, now position imageDiv
			var dTop = parseInt(imgDiv.css("top"));
			var dLeft = parseInt(imgDiv.css("left"));
			
			switch(placement.align_left) {
				case "start": break;
				case "center": dLeft = dLeft + (imgDiv.width() / 2) - dWidth / 2;break;
				case "end": dLeft = dLeft + (imgDiv.width()) - dWidth; break;
			}
			switch(placement.align_top) {
				case "start": break;
				case "center": dTop = dTop + (imgDiv.height() / 2) - dHeight / 2; break;
				case "end": dTop = dTop + (imgDiv.height()) - dHeight; break;
			}
			console.log("imageDiv top:",dTop, " left", dLeft);
			// Position image
			var iLeft = (dWidth - iWidth) / 2;
			var iTop = (dHeight - iHeight) / 2;
			console.log("orig top:", imgDiv.css("top"), " left", imgDiv.css("left"), "width:", imgDiv.width(), "height", imgDiv.height());
			console.log("imgDiv top:", dTop, " left", dLeft, "width:", dWidth, "height", dHeight);
			console.log("img top:", iTop, " left", iLeft, "width:", iWidth, "height", iHeight);
			imgDiv.css({
				top: dTop + "px",
				left: dLeft + "px",
				width: dWidth + "px",
				height: dHeight + "px"
			});
			img.css({
				top: iTop + "px",
				left: iLeft + "px",
				width: iWidth + "px",
				height: iHeight + "px"
			});
		}
		PB.UI.Bookpage.updateImageControls(imgDiv);
	}
}
function updatePlacement() {
	var placement = $("#sizing").val();
	placement += " " + $("#rotate").val();
	placement += " " + $("#align_left").val();
	placement += " " + $("#align_top").val();
	$("#valstr").attr("value", placement);
	$(".book-image").attr("data-placement", placement);
	$(".book-image").each(function(index, el) {
		PB.UI.Bookpage.imageLoaded(el);
	});
}
PB.UI.MainContainer = {
	_init: $(document).ready(function() { PB.UI.MainContainer.init() }),
	init: function() {
		PB.CommandQueue.bind('commandQueueChanged', function() {
				PB.UI.MainContainer.commandQueueChanged();
			});
		$("#redo-button").click(function() {
			PB.CommandQueue.redo();
		});
		$("#undo-button").click(function() {
			PB.CommandQueue.undo();
		});
		this.commandQueueChanged();
	},
	commandQueueChanged: function() {
		$("#redo-button").attr('disabled', !PB.CommandQueue.canRedo());
		$("#undo-button").attr('disabled', !PB.CommandQueue.canUndo());
	},
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
		page.parent().css("transform", "scale("+scale+")")
			.css("left", (mainWidth - pageWidth ) / 2 + (pad / 2) + "px")
			.css("top", (mainHeight - pageHeight) / 2 + (pad / 2) + "px");
	},
}

