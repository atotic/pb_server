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
	// Can be called as a callback, and 'this' is invalid. Do not refer to 'this' in this function
	resize: function() {
		var newHeight = Math.floor(window.innerHeight - PB.UI.MainContainer.mainEl.offset().top - 3);
		// As a precaution, we call resize a lot, so it is good to optimize it out if not needed
		if ((newHeight + "px"  == PB.UI.MainContainer.mainEl.css("height")))
			return;
		$("#main-container").css("height", newHeight + "px");
		PB.UI.MainContainer.fitContent();
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

