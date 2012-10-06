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
	},
	bindToBook: function(book) {
		$(ID)
			.data('model', book)
			.on(PB.MODEL_CHANGED, this.bookChanged);
	},
	get book() {
		return $(ID).data('model');
	},
	get currentPage() {
		return $(ID).find('.designPage').data('model');
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
		document.getElementById('work-area').style.setProperty('padding-left', '0px');
		$('#work-area').css('padding-left', 0);
		$(ID).show();
		if (!this.book.bookTemplateId)
			this.showThemePicker();
		else {
			this.showDesignArea();
		}
	},
	hide: function() {
		document.getElementById('work-area').style.removeProperty('padding-left');
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
	showPages: function(pageOrArray) {
		$(ID).children('.designPage').detach();
		if (typeof pageOrArray == 'object' && pageOrArray instanceof Array)
			;
		else
			pageOrArray = [pageOrArray];	// make it an array

		var jDom = $();
		var total = { width:0, height: 0};
		for (var i=0; i<pageOrArray.length; i++) {
			var dom = $(pageOrArray[i].dom(PB.PhotoProxy.MEDIUM));
			dom.addClass('designPage');
			dom.data('model', pageOrArray[i]);
			total.width += dom.outerWidth();
			total.height = Math.max(total.height, dom.outerHeight());
			jDom = jDom.add(dom);
		}
		var hScale = $(ID).innerWidth() / total.width;
		var vScale = $(ID).innerHeight() / total.height;
		var scale = Math.min(Math.min(hScale, vScale), 1);
		var left = ($(ID).innerWidth() - total.width * scale) / 2;
		var top = ($(ID).innerHeight() - total.height * scale) / 2;
		for (var i=0; i<jDom.length; i++) {
			var scaleTransform = ' scale(' + scale + ')';
			var posTransform = ' translate(' + left + 'px, ' + top + 'px)';
			var dom = jDom.eq(i);
			dom.css('transform', posTransform + scaleTransform);
			left += dom.outerWidth() * scale;
		}
		$(ID).append(jDom);
	},
	showDesignArea: function() {
		$('#theme-picker').detach();
		$('#palette, ' + ID).show();
		GUI.PhotoPalette.show();
		GUI.fixSizes();

		GUI.CommandManager.addCommandSet(this.commandSet);

		this.book.loadTemplates()
			.done(function() {
				var facingPages = DesignWorkArea.book.facingPages;
				var display = facingPages.get(0);
				if (display)
					DesignWorkArea.showPages(display);
				else
					PB.error("no pages in the book!");
			})
			.fail(function() { debugger;});
	},
	pickTheme: function(themeTemplate, bookTemplate) {
		var book = $(ID).data('model');
		book.setBookTemplate(themeTemplate.id, bookTemplate.id);
		book.generateAllPagesHtml(function(msg) {
		});
	},
	goBack: function() {
		var nextPages = this.book.facingPages.before(this.currentPage);
		this.showPages(nextPages);
	},
	goForward: function() {
		var nextPages = this.book.facingPages.after(this.currentPage);
		this.showPages(nextPages);
	}
}

scope.DesignWorkArea = DesignWorkArea;
scope.ThemePicker = ThemePicker;

})(GUI);
