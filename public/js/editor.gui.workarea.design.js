// editor.gui.designworkarea.js

// #work-area-design implementation. Visible in 'Design' mode

(function(scope) {

var ID= '#work-area-design';
var THEME_LIST_SELECTOR = '#theme-picker-container > ul';

var ThemePicker = {
	init: function(dom) {
		this.initThemeList(dom);
		this.initButtonList(dom);
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
	bindToBook: function(book) {
		$(ID)
			.data('model', book)
			.on(PB.MODEL_CHANGED, this.bookChanged);
	},
	get book() {
		return $(ID).data('model');
	},
	bookChanged: function() {
	},
	show: function() {
		$(ID).show();
		if (!this.book.bookTemplateId) {
			var picker = GUI.Template.append($(ID), 'theme-picker');
			ThemePicker.init(picker);
		}
	},
	hide: function() {
		$(ID).hide();
	},
}

scope.DesignWorkArea = DesignWorkArea;
scope.ThemePicker = ThemePicker;

})(GUI);
