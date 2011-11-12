"use strict";
//
// PB global functions
//
$.extend(PB, new PB.EventBroadcaster("docLoaded"));

$.extend(PB, {
	_init: $(document).ready(function() { PB.init() }),

	init: function () {
/*		var match = window.location.pathname.match(/books\/(\d+)/);
		if (match != null)
			this.load(match[1]);
*/
	},

	book: function() {
		return this._book;
	},

	bookById: function(id) {
		if (this._book.id != id)
			throw "Book id mismatch";
		return this._book;
	},
	setBookFromJson: function(json) {
		try {
			this._book = new PB.Book(json);
			this._book.connectServerStream(false);
			this._book.bind("serverStreamUpToDate", function(book) {PB.QueueFilter.ServerStreamUpdate.serverStreamUpToDate(book)})
		}
		catch(e) {
			console.error("Unexpected error creating book from JSON" + e);
		}
		PB.UI.bookLoaded(this._book);
	},
	
	// Loads the book, unused
	load: function(id) {
		$("#main-container").html("<h1>Loading...</h1>");
		var self = this;
		PB.Book.get(id)
			.success( function(json, status, jqXHR) {
				PB.setBookFromJson(json);
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
		// Flippies
		$(".slab").each( function() {
			var slab = $(this); 
			var slab_content = slab.find('.slab_content');
			var flippy = slab.find('.flippy');
			var slab_click = slab.find('.slab_title');
			$(flippy).flippy('open', slab_content, slab_click);
		});
		// ???
		$(document).bind('drop dragover dragenter dragleave', PB.stopEvent);
		// Paging arrows
		$(window).keypress(function(ev) {
			switch(ev.keyCode) {
				case 39: PB.UI.Pagetab.next(); break;
				case 37: PB.UI.Pagetab.prev(); break;
			}
		});
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
		book.bind('pageDeleted', function(page, index) {
			PB.UI.Pagetab.pageDeleted(page, index);
		});
		book.bind('pageReplaced', function(page) {
			PB.UI.Pagetab.pageReplaced(page);
			PB.UI.Bookpage.pageReplaced(page);
		});
		// Load in the document data
		PB.UI.Phototab.clear();
		var images = book.photos;
		for (var i=0; i < images.length; i++)
			PB.UI.Phototab.imageAdded(images[i], i, true);
		var pages = book.pages;
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
			PB.UI.Pagetab.selectPage(book.firstPage());
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
					PB.Model.Util.addFilesToBook(PB.book(), e.originalEvent.dataTransfer.files);			
				},
				'dragover': function(e) {
//					console.log("dragover" + e.currentTarget);
					$("#photos-tab").addClass('drop-feedback');
					PB.stopEvent(e);
				}
		};
		// accept dragged images
		$("#photos-tab").bind(imageTabDragEvents);

		$("#file-dialog").click(function(e) {
			e.stopPropagation();
		});
		$("#file-dialog").change(function(e) {
			PB.stopEvent(e);
			PB.Model.Util.addFilesToBook(PB.book(), this.files);
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
		this.initButtons();
		$(window).resize(this.restyleSlider);
	},
	initButtons: function() {
		$("#add-image-file-button").click(function() {
			$("#file-dialog").click();
		});
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

/*
 * Pagetab shows page icons.
 * It broadcasts pageSelectionChanged event
 */ 
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
		// Update page icons by replacing them
		PB.BookPage.bind("pageIconUpdated", function(page) {
			$("#page-list .page-icon").each(function(index) {
				var el = $(this);
				if (el.data('book_page') == page) {
					var newIcon = PB.UI.Pagetab.getIconForPage(page);
					if (el.hasClass("selected"))
						newIcon.addClass("selected");
					el.replaceWith(newIcon);
				}
			});
			PB.UI.Pagetab.updatePageStyles();
		});
		PB.UI.Pagetab.initButtons();
	},
	initButtons: function() {
		// Hook up the buttons
		$("#add-page-button").click(function() {
			var options = PageDialog.addPageOptions();
			options.ok = function(templates, desiredPageCount) {
				var cmd = new PB.Commands.AddPages(PB.book(), PB.UI.Pagetab.selectionAsPages(), templates, desiredPageCount);
				PB.CommandQueue.execute(cmd);
			};
			PageDialog.show(options);
		});
		$("#layout-page-button").click(function() {
			var selection = PB.UI.Pagetab.selection();
			if (!selection.length)
				return;
			var page = selection[0].data("book_page");
			var options = PageDialog.changeLayoutOptions( page.position );
			PageDialog.show(options);
		});
		this.bind("pageSelectionChanged", this.pageSelectionChanged);
		this.pageSelectionChanged(this.selection()); // Initializes buttons
	},
	// Select next pages
	next: function() {
		var sel = this.selection();
		if (sel.length == 0)
			return; 
		var children = sel[0].parent().children(".page-icon");
		var next = children.get(children.index(sel[0]) + 1);
		if (next)
			this.selectPage($(next).data("book_page"));
	},
	prev: function() {
		var sel = this.selection();
		if (sel.length == 0)
			return;
		var children = sel[0].parent().children(".page-icon");
		var prev = children.index(sel[0]) - 1;
		if (prev >= 0)
			this.selectPage($(children.get(prev)).data("book_page"));
	},
	selectPage: function(page, ev) {
		var self = this;
		var changed = false;
		var action = 'select';
		if (ev) {
			if (ev.originalEvent.shiftKey || ev.originalEvent.metaKey)
				action = 'toggle';
		}
		$('#page-list .page-icon').each(function() {
			var c = $(this);
			if (c.data('book_page') == page) {	// clicked icon
				if (c.hasClass('selected'))
					switch(action) {
						case 'select': break;
						case 'toggle': c.removeClass('selected'); changed = true; break;
					}
				else {
					c.addClass('selected');
					changed = true;
					PB.UI.Bookpage.setCurrentPage(page);
				}
			}
			else { // other icons
				if (c.hasClass('selected')) {
					switch(action) {
						case 'select': c.removeClass('selected');changed = true;break;
						case 'toggle': break;
					}
				}
			}
		});
		if (changed)
			this.send('pageSelectionChanged', this.selection());
	},
	pageSelectionChanged: function(sel) {
		$("#layout-page-button").attr("disabled", sel.length == 0);
	},
	revealNthPage: function(n) {
		$("#page-list").revealByMarginLeft(".page-icon:nth-child(" + n+ ")");		
	},
	getIconForPage: function(page) {
		var icon = page.toIcon( { desiredHeight: 64 });
		icon.data('book_page', page);
		icon.click(function(ev) {
			PB.UI.Pagetab.selectPage(page, ev);
		});
		return icon;
	},
	updatePageStyles: function() {
		var icons = $("#page-list .page-icon");
		icons.each(function(i, el) {
			if (i % 2 == 0)
				$(el).addClass("left-page-icon").removeClass("right-page-icon");
			else
				$(el).addClass("right-page-icon").removeClass("left-page-icon");
		});
	},
	pageAdded: function(page, index, noScroll) {
		$("#pages-tab .intro").hide();
		// add new page
		var icon = this.getIconForPage(page);
		if (index == 0)
			icon.prependTo('#page-list');
		else {
			var prevIcon = $("#page-list .page-icon:eq(" + (index - 1) + ")");
			if (prevIcon.length > 0)
				icon.insertAfter(prevIcon);
			else {
				debugger;
				icon.appendTo('#page-list');
			}
		}
		this.updatePageStyles(); 
		// reflow when visible
		$('#pages-tab').reflowVisible(function(immediate) {
			// Resize the container
			var allPages = $('#page-list .page-icon');
			var newWidth = allPages
				.map(function() {return $(this).outerWidth(true)})
				.get()
				.reduce( function(sum, prop) { return sum + prop;}) + 2;
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
	},
	pageDeleted: function(deleted_page, index) {
		$('#page-list .page-icon').each(function() {
			var c = $(this);
			var our_page = c.data('book_page');
			if (our_page.id == deleted_page.id) {
				c.detach();
			}
		});
		if (this.selection().length == 0) {
			var pages = $("#page-list .page-icon");
			if (pages.size() > index)
				this.selectPage($(pages.get(index)).data('book_page'));
			else
				this.selectPage($(pages.get(pages.size() - 1)).data('book_page'));
		}
	},
	pageReplaced: function(new_page) {
		var THIS = this;
		$('#page-list .page-icon').each(function() {
			var c = $(this);
			var old_page = c.data('book_page');
			if (old_page.id == new_page.id) {
				var icon = THIS.getIconForPage(new_page);
				if (c.hasClass('selected'))
					icon.addClass('selected');
				c.replaceWith(icon);
			}
		});
		this.updatePageStyles();
	},
	// Returns an array of page-icon divs. div.data("book_page") gets you real page
	selection: function() {
		var selection = [];
		$('#page-list .page-icon').each(function() {
			var c = $(this);
			if (c.hasClass("selected"))
				selection.push(c);
		});
		return selection;
	},
	selectionAsPages: function() {
		return this.selection().map(function(div) { return div.data("book_page")});
	}
}

$.extend(PB.UI.Pagetab, new PB.EventBroadcaster("pageSelectionChanged"));

/* Page in a book
 * Main page element contains data:
 * page-id, dirty, and class "page"
 *
 * DOM structure:
 * #main-container
 *   div.page-enclosure data:page(model)
 * 		 div.book-page
 *       
 */
PB.UI.Bookpage = {

	attachImageManipulators: function(bookImage) {
		bookImage = $(bookImage);
		var events = {
			mouseenter: function(ev) {
				if (bookImage.find(".actual-image").length == 0 || bookImage.data("hide-manipulators"))
					return;	// nothing to show, no image
				else
					PB.Manipulators.createImageButtons(bookImage);
			},
			mouseleave: function(ev) {
				bookImage.find(".manipulator-button").remove();				
			}
		}
		bookImage.bind(events);
	},
	attachTextManipulators: function(bookText) {
		bookText = $(bookText);
		var events = {
			mouseenter: function(ev) {
				if (bookText.data("hide-manipulators"))
					return;
				PB.Manipulators.Text.createTextButtons(bookText);			
			},
			mouseleave: function(ev) {
				if (! bookText.data("show-manipulators"))
					bookText.find(".manipulator-button").remove();
			}
		}
		bookText.bind(events);
	},
	// Loads page from model
	createPageElement: function(page) {
		var el = $(page.browserHtml());
		el.addClass("book-page");
		var enclosingDiv = $("<div></div>")
			.addClass('page-enclosure')
			.css("position", "relative")
			.css("width", el.css('width'))
			.css("height", el.css('height'))
			.data('page', page);
		enclosingDiv.append(el);
		el.find(".book-image").each( function() {
		// this must come after we are inside the enclosing div
				PB.Manipulators.makeDroppableImage(this);
				PB.UI.Bookpage.attachImageManipulators(this);
			});
		el.find(".book-text").each( function() {
			PB.Manipulators.Text.makeEditable(this);
			PB.UI.Bookpage.attachTextManipulators(this);
		});
		page.setDisplayDom(enclosingDiv);
		return enclosingDiv;
	},
	setCurrentPage: function(page) {
		// save the old page if possible
		$("#main-container div.page-enclosure").each(function() {
			var page = $(this).data('page');
			page.saveNow();
			page.setDisplayDom(null);
		});
		var dom = this.createPageElement(page);
		dom.appendTo($("#main-container").empty());
		PB.UI.MainContainer.fitContent();
	},
	pageReplaced: function(page) {
		var THIS = this;
		$("#main-container div.page-enclosure").each(function() {
			var current_page = $(this).data('page');
			if (current_page.id == page.id)
			{
				var dom = THIS.createPageElement(page);
				dom.appendTo($("#main-container").empty());
				PB.UI.MainContainer.fitContent();
			}
		});		
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
//					console.log("flexing, vertical fill iWidth: " + iWidth + " iHeight:" + iHeight + " dHeight:" + dHeight);
				} else {
					iWidth *= imageHScale;
					iHeight *= imageHScale;
					dWidth = iWidth;
					dHeight = iHeight;
//					console.log("flexing, horizontal fill iWidth: " + iWidth + " iHeight:" + iHeight + " dHeight:" + dHeight);
				}
			} else {
				// Fixed sizing, smallest image dimension fills div completely
				if (imageVScale < imageHScale) {
					iWidth *= imageHScale;
					iHeight *= imageHScale;
//					console.log("fixed, horizontal iWidth: " + iWidth + " iHeight:" + iHeight);
				}
				else {
					iWidth *= imageVScale;
					iHeight *= imageVScale;
//					console.log("fixed, vertical iWidth: ",iWidth, " iHeight:", iHeight);
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
//			console.log("imageDiv top:",dTop, " left", dLeft);
			// Position image
			var iLeft = (dWidth - iWidth) / 2;
			var iTop = (dHeight - iHeight) / 2;
//			console.log("orig top:", imgDiv.css("top"), " left", imgDiv.css("left"), "width:", imgDiv.width(), "height", imgDiv.height());
//			console.log("imgDiv top:", dTop, " left", dLeft, "width:", dWidth, "height", dHeight);
//			console.log("img top:", iTop, " left", iLeft, "width:", iWidth, "height", iHeight);
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
	}
}
function updatePlacement() {
// This function is testing only
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

