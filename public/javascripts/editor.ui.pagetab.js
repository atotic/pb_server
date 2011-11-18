"use strict"

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
		this.dragScroll();
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
		$("#delete-page-button").click(function() {
			var cmd = new PB.Commands.DeletePages(PB.book(), PB.UI.Pagetab.selectionAsPages());
			PB.CommandQueue.execute(cmd);
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
	dragScroll: function() {
		var handler = {
			lastX: -1,
			delta: 0,
			lastTime: 0,
			speed: 0,	// in pixels per milisecond
			mousedown: function(ev) {
				ev.preventDefault();
				handler.lastX = ev.pageX;
				handler.speed = 0;
				handler.lastSeen = ev.timeStamp;
				$(document).one("mouseup" ,function(ev) {
					// Try 
					$("#page-list").scrollMarginLeft(handler.speed * 100, true);
					handler.lastX = -1;
				});
			},
			mousemove: function(ev) {
				if (handler.lastX != -1) {
					ev.preventDefault();
					handler.delta = ev.pageX - handler.lastX;
					$("#page-list").scrollMarginLeft(handler.delta);
					handler.speed = handler.delta / (ev.timeStamp - handler.lastTime);
					handler.lastTime = ev.timeStamp;
					handler.lastX = ev.pageX;
				}
			}
		}
		$("#page-list-container").bind(handler);
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
		$("#add-page-button").attr("disabled", false);
		$("#delete-page-button").attr("disabled", !sel.some(function(el) {
			return el.data("book_page").position == 'middle';
		}));
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
		this.updatePageStyles();
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
