// editor.gui.designworkarea.js

// #work-area-design implementation. Visible in 'Design' mode

(function(scope) {

var ID= '#work-area-design';
var THEME_LIST_SELECTOR = '#theme-picker-container > ul';
var THEME_SIZE_SELECTOR = '#theme-size-container > label';

var ThemePicker = {
	init: function(dom) {
		this.initThemeList(dom);
		this.initButtonList(dom);
	},
	initThemeList: function(dom) {
		var themeList = dom.find(THEME_LIST_SELECTOR);
		themeList.children().remove();
		function fail(response) {
			themeList.append($("<li><div class='alert alert-error'>Themes failed to load</div></li>"));
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
	initButtonList: function(dom) {
		var sizeContainer = dom.find('#theme-size-container');
		sizeContainer.children('label').remove();
		var theme = this.selectedTheme;
		if (!theme) {
			return;
		}

	},
	selectTheme: function(id) {
		var themesLi = $(THEME_LIST_SELECTOR).children('li');
		selected = themesLi.filter('.active');
		desired = themesLi.filter('*:data("theme.id=' + id + '")');
		if (selected.get(0) != desired.get(0)) {
			selected.removeClass('active');
			desired.addClass('active');
			this.initButtonList($(THEME_SIZE_SELECTOR).parent());
			this.updateSelectThemeButton();
		}
	},
	get selectedTheme() {
		return $(THEME_LIST_SELECTOR).children('li.active').data('theme');
	},
	get selectedSize() {
		return undefined;
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

})(GUI);
