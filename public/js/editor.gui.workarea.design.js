// editor.gui.designworkarea.js

// #work-area-design implementation. Visible in 'Design' mode

(function(scope) {

var ID= '#work-area-design';
var THEME_LIST_SELECTOR = '#theme-picker-container > ul';

var ThemePicker = {
	init: function(dom) {
		this.initThemeList(dom);
		this.initButtonList(dom);
		dom.find('#theme-picker-submit').click(function() {
			if (!$(this).hasClass('disabled') && ThemePicker.selectedTheme && ThemePicker.selectedSize)
				DesignWorkArea.pickTheme(ThemePicker.selectedTheme, ThemePicker.selectedSize) });
	},
	initThemeList: function(dom) {
		var themeList = dom.find(THEME_LIST_SELECTOR);
		themeList.children().remove();
		function fail(response) {
			GUI.Template.append(themeList, 'theme-failed-to-load');
		}
		PB.Template.get(PB.Template.THEME_LIST)
			.done(function(themeListResponse) {
				// Initialize theme list
				var themeIdList = themeListResponse[PB.Template.THEME_LIST].themes;
				PB.Template.get(themeIdList)
				.done(function(themeResponse) {
					themeIdList.forEach( function(themeId) {
						var theme = themeResponse[themeId];
						var themeLi = GUI.Template.get('theme-picker-onetheme', {
							title: theme.title,
							img: '/template/img/' +theme.sample_images[0]});
						themeLi = $(themeLi);
						themeLi.data('theme', theme);
						themeList.append(themeLi);
						themeLi.click(function(ev) {
							ThemePicker.selectTheme(theme.id);
						});
					});
				})
				.fail(fail);
			})
			.fail(fail);
	},
	initButtonList: function() {
		var sizeContainer = $('#theme-size-container');
		sizeContainer.children('label, #sizes-failed-to-load').remove();
		var theme = this.selectedTheme;
		if (!theme) {
			return;
		}
		function fail() {
			GUI.Template.append(sizeContainer,'sizes-failed-to-load');
		}
		PB.Template.get(theme.books)
			.done(function(bookResponse) {
				theme.books.forEach(function(bookId) {
					var book = bookResponse[bookId];
					var buttonDom = $( GUI.Template.get('theme-size-radio', {
						width: book.width,
						height: book.height
					}));
					buttonDom.find('input[type=radio]').data('book', book);
					sizeContainer.append(buttonDom);
				});
				$('#theme-size-container input[type=radio]').change(function() {
					ThemePicker.updateSelectThemeButton();
				});
			})
			.fail(fail);
	},
	selectTheme: function(id) {
		var themesLi = $(THEME_LIST_SELECTOR).children('li');
		selected = themesLi.filter('.active');
		desired = themesLi.filter('*:data("theme.id=' + id + '")');
		if (selected.get(0) != desired.get(0)) {
			selected.removeClass('active');
			desired.addClass('active');
			this.initButtonList();
			this.updateSelectThemeButton();
		}
	},
	get selectedTheme() {
		return $(THEME_LIST_SELECTOR).children('li.active').data('theme');
	},
	get selectedSize() {
		var checked = $('#theme-size-container input[type=radio]:checked');
		return checked.data('book');
	},
	updateSelectThemeButton: function() {
		if (this.selectedTheme && this.selectedSize)
			$('#theme-picker-submit').removeClass('disabled');
		else
			$('#theme-picker-submit').addClass('disabled');
	}
};

var DesignWorkArea = {
	init: function() {
		this.commandSet = new GUI.CommandSet("design");
		this.commandSet.add(
			new GUI.Command(
				'designBack',
				GUI.CommandManager.keys.leftArrow,
				false,
				function() {GUI.DesignWorkArea.goBack()}
			));
		this.commandSet.add(
			new GUI.Command(
				'designForward',
				GUI.CommandManager.keys.rightArrow,
				false,
				function() {GUI.DesignWorkArea.goForward()}
			));
		$('#work-area-design-btn-back').click(function(ev) {
			GUI.DesignWorkArea.goBack();
			ev.preventDefault();
		});
		$('#work-area-design-btn-forward').click(function(ev) {
			GUI.DesignWorkArea.goForward();
			ev.preventDefault();
		});
		$(window).resize(function() {
			if (!($(ID).is(':visible')))
				return;
			try {
				DesignWorkArea.showPages(DesignWorkArea.currentPages);
			}
			catch(ex) {
				debugger;
			}
		});
	},
	bindToBook: function(book) {
		$(ID)
			.data('model', book)
			.on(PB.MODEL_CHANGED, this.bookChanged);
		try {
			this._lastPage = book.page(GUI.Options.designPage);
		}
		catch(ex) {
			console.log("last page not found");
		}
	},
	get book() {
		return $(ID).data('model');
	},
	get currentPage() {	// just first page
		return $(ID).find('.designPage').data('model');
	},
	get currentPages() { // all pages
		var retVal = [];
		$(ID).find('.designPage').each( function() {
			retVal.push($(this).data('model'));
		});
		return retVal;
	},
	bookChanged: function(ev, model, prop, options) {
		switch(prop) {
			case 'template':
				if ($(ID+':visible, #theme-picker:visible').length == 1)	//
					DesignWorkArea.show();
				break;
			default:
				;
		}
	},
	show: function() {
		var workArea = document.getElementById('work-area');
		workArea.style.setProperty('padding-left', '0px');
		workArea.style.setProperty('padding-top', '0px');
		$('#work-area').css('padding-left', 0);
		$(ID).show();
		if (!this.book.bookTemplateId)
			this.showThemePicker();
		else {
			this.showDesignArea(this._lastPage);
		}
	},
	hide: function() {
		this._lastPage = this.currentPage;
		var workArea = document.getElementById('work-area');
		workArea.style.removeProperty('padding-left');
		workArea.style.removeProperty('padding-top');
		$(ID).hide();
		$('#theme-picker').detach();
		GUI.CommandManager.removeCommandSet(this.commandSet);
	},
	showThemePicker: function() {
		$('#palette, ' + ID).hide();
		var picker = GUI.Template.append($('#work-area-container'), 'theme-picker');
		ThemePicker.init(picker);
		GUI.fixSizes();
	},
	getPagePositions: function(book) {
		var vinset = 20;
		var hinset = 44;
		var bookTemplate = PB.Template.cached(book.bookTemplateId);
		var pageWidth = bookTemplate.pixelWidth;
		var pageHeight = bookTemplate.pixelHeight;
		var idWidth = $(ID).width() - hinset * 2;	// -1 for rounding errors
		var idHeight = $(ID).height() - vinset;
		var totalWidth = pageWidth * 2;
		var totalHeight = pageHeight;
		var hScale = idWidth / totalWidth;
		var vScale = idHeight / totalHeight;
		var scale = Math.min(Math.min(hScale, vScale), 1);
		var left = (idWidth - totalWidth * scale) / 2 + hinset;
		var top = 4 + (idHeight - totalHeight * scale) / 2;
		return {
			left: {
				x: left,
				y: top,
				width: pageWidth * scale,
				height: pageHeight * scale
			},
			right: {
				x: left + pageWidth * scale,
				y: top,
				width: pageWidth * scale,
				height: pageHeight * scale
			},
			pageWidth: pageWidth,
			pageHeight: pageHeight,
			scale: scale
		}
	},
	showPages: function(pages) {
		if (!pages) {
			PB.error("page does not exist");
			return;
		}
		$(ID).find('.design-book-page-left, .design-book-page-right').detach();

		var pos = this.getPagePositions(this.book);

		var pagesDom = [];
		for (var i=0; i<pages.length; i++) {
			if (pages[i] == null)
				continue;
			var dom = $(pages[i].dom(PB.PhotoProxy.MEDIUM));
			dom.addClass('designPage');
			dom.data('model', pages[i]);
			pagesDom[i] = dom;
		}
		var leftDom = $("<div class='design-book-page-left'/>");
		leftDom.css({
			top: pos.left.y,
			left: pos.left.x,
			width: pos.left.width,
			height: pos.left.height
		});
		var rightDom = $("<div class='design-book-page-right'/>");
		rightDom.css({
			top: pos.right.y,
			left: pos.right.x,
			width: pos.right.width,
			height: pos.right.height
		});
		if (pagesDom[0]) {
			var scaleTransform = 'scale(' + pos.scale.toFixed(4) + ')';
			pagesDom[0].css('transform', scaleTransform);
			leftDom.append(pagesDom[0]);
			leftDom.append($('<p class="pageTitle">').text(pages[0].pageTitle()));
		}
		if (pagesDom[1]) {
			var transform = 'scale(' + pos.scale.toFixed(4) + ')';
			var widthDiff = pos.pageWidth  - pagesDom[1].width();
			if (widthDiff > 5) {
				transform += ' translate(' + widthDiff.toFixed(4) + 'px)';
			}
			pagesDom[1].css('transform', transform);
			rightDom.append(pagesDom[1]);
			rightDom.append($('<p class="pageTitle">').text(pages[1].pageTitle()));
		}
		$(ID).append(leftDom).append(rightDom);
	},
	showDesignArea: function(page) {
		$('#theme-picker').detach();
		$('#palette, ' + ID).show();
		GUI.PhotoPalette.show();
		GUI.fixSizes();

		GUI.CommandManager.addCommandSet(this.commandSet);
		this.book.loadTemplates()
			.done(function() {
				DesignWorkArea.goTo(page);
			})
			.fail(function() { PB.error("Missing page template");});
	},
	pickTheme: function(themeTemplate, bookTemplate) {
		var book = $(ID).data('model');
		book.setBookTemplate(themeTemplate.id, bookTemplate.id);
		book.generateAllPagesHtml(function(msg) {
			PB.error("msg");
		});
	},
	goTo: function(page) {
		var facingPages = this.book.facingPages;
		var show = facingPages.find(page);
		if (!show)
			show = 0;
		else
			GUI.Options.designPage = page.id;
		this.showPages(facingPages.get(show));
	},
	goBack: function() {
		var show = this.book.facingPages.before(this.currentPage);
		this.goTo(show[0]);
	},
	goForward: function() {
		var show = this.book.facingPages.after(this.currentPage);
		this.goTo(show[0]);
	}
}

scope.DesignWorkArea = DesignWorkArea;
scope.ThemePicker = ThemePicker;

})(GUI);
