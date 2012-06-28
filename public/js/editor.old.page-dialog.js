// Displays a list of template pages to pick from.
// Used for new pages
PageDialog = {
	// Shows the dialog
	show: function(options) {

		options = $.extend( {
			filter: function(x) { return true;},
			ok: function(pages) { pages.forEach(function(p) { console.log("page " + p.id)} ) },
			title: "Pick a page demo",
			showPageCount: true,
			showTextOption: true
		}, options);

		if ($("#pick-page-icons .page-icon").length == 0)	{
			var deferred = PB.BookTemplate.get("modern_lines");
			deferred.done(function(template) {
					PageDialog.initializePageDialog(template);
					PageDialog.show(options);
				});
		}
		else {
			// process options, show dialog
			$("#pick-page-count").val('1');
			PageDialog.filterPageDialog(options.filter);
			PageDialog.filterText();
			options.showPageCount ? $("#pick-page-count, label[for=pick-page-count]").show()
			: $("#pick-page-count, label[for=pick-page-count]").hide();
			options.showTextOption ? $("#pick-page-text, label[for=pick-page-text]").show()
			: $("#pick-page-text, label[for=pick-page-text]").hide();

			$("#pick-page-dialog")
				.data("options", options)
				.dialog("option", "title", options.title)
				.dialog("open");
		}
	},

	// Options for AddPage dialog style
	addPageOptions: function() {
		return {
			filter: function(page) {
					// filter middle pages, number pages + random
					if (typeof page == "string") {
						if (page == "random")
							return true;
						else if (page == "number")
							return true;
					}
					else
						return page.position == "middle";
				},
			title: "Pick a style for a new page:",
			showPageCount: true,
			showTextField: true
		}
	},
	// Options for ChangeLayout dialog style
	changeLayoutOptions: function(pagePosition) {
		return {
			filter: function(page) {
				if (typeof page == "string")
					return pagePosition == "middle" && page == "number";
				else
					return page.position == pagePosition;
			},
			title: "Pick a new layout",
			showPageCount: false,
			showTextField: false
		}
	},

	// Filter helper
	filterPageDialog: function (filter) {
		$("#pick-page-icons .page-icon").each(function(i, el) {
			var page = $(el).data("page");
			if (filter(page)) {
				$(el).addClass("pick-page-ready").show();
			}
			else
				$(el).removeClass("pick-page-ready").hide();
		});
	},

	filterText: function() {
		var showText = $('#pick-page-text').get(0).checked;
		$("#pick-page-icons .pick-page-ready").each(function(i,el) {
			el = $(el);
			var page = el.data("page");
			var show = showText
				|| (typeof page == "object" && "text_count" in page && page.text_count < 1)
				|| (typeof page == "string");
			if (show)
				el.show();
			else
				el.hide();
		});
	},

	// Click event callback
	clickIcon: function() {
		var THIS = $(this);
		if (THIS.hasClass("selected"))
			return;
		$("#pick-page-icons .page-icon").each(function(i, el) {
			if (THIS.is(el))
				$(el).addClass("selected");
			else
				$(el).removeClass("selected");
		});
	},

	dblClickIcon: function() {
		PageDialog.close(true);
	},

	// Initializes page dialog from the template
	// All possible pages are inserted into DOM. Different dialog styles filter them out'
	// Pages are:
	// standard page icons, random icon, and number icons
	initializePageDialog: function (template) {
		var dialog = $("#pick-page-dialog");
		$( "#pick-page-dialog" ).dialog({
			autoOpen: false,
			width: dialog.width(),
			height: dialog.height(),
			modal: true,
			draggable: false,
			title: "DEMO PICK"
		});

		// collect the pages
		var pages = template.pages.sort(PB.PageTemplate.sortFunction);
		// add random icon
		var randomDiv = $("<div id='add-random' class='page-icon'><p>random</p></div>");
		randomDiv.data("page", "random");
		randomDiv.click(PageDialog.clickIcon);
		$("#pick-page-icons").append(randomDiv);
		// fill in the pages
		var last_image_count = 0;
		pages.forEach(function(page) {
			// Add number icons for middle position
			if (page.position == "middle" && page.image_count > 0 && page.image_count != last_image_count) {
				last_image_count = page.image_count;
				var numberDiv = $("<div class='pick-page-numbers page-icon'><p>" + page.image_count + "</p></div>");
				numberDiv.data("page", "number");
				$("#pick-page-icons").append(numberDiv);
			}
			var icon = page.toIcon( {desiredHeight: 64} );
			icon.data("page", page);
			icon.click(PageDialog.clickIcon);
			icon.dblclick(PageDialog.dblClickIcon);
			$("#pick-page-icons").append(icon);
		});
		// button events
		$("#pick-page-text").change(function() {
			PageDialog.filterText();
		}).attr("checked", true);
		$("#pick-page-cancel").click(function() {
			PageDialog.close(false);
		});
		$("#pick-page-ok")
			.click(function() { PageDialog.close(true); });

	},
	close: function(ok) {
		var d = $("#pick-page-dialog");
		if (ok) {
			d.data("options").ok(PageDialog.selection(), $('#pick-page-count').val());
		}
		$("#pick-page-dialog").dialog("close");
	},
	// Returns array of selection
	selection: function() {
		var sel = [];
		$("#pick-page-icons .pick-page-ready").each(function(i,el) {
			if ($(el).hasClass("selected"))
				sel.push($(el).data('page'));
		});
		return sel;
	}
}
