// editor.gui.workarea.theme.js

(function(scope) {
"use strict"
var ID='#work-area-theme';

var ThemeWorkArea = {
	getBook: function() {
		return PB.ModelMap.model( $('body').data('model_id') );
	},
	show: function() {
		$('#work-area').addClass('theme');
		var $dom = $('#work-area-theme');
		$dom.show();
		$dom.append( this.getSizePicker());
		this.loadThemePicker();
		$('#workarea-menu').find('li').hide();
	},
	hide: function() {
		$('#work-area').removeClass('theme');
		$(ID).hide();
		$('#work-area-size-pick').remove();
		$('#theme-picker').remove();
	},
	getSizePicker: function() {
		var sizes = [	// inches
			{ width: 7, height: 5},
			{ width: 4, height: 4 },
			{ width: 8, height: 8 },
			{ width: 12, height: 12},
			{ width: 11, height: 8 }
		];
		function assignCb($el, size) {
			$el.on('touchstart mousedown', function() {
				ThemeWorkArea.getBook().setDimensions(
					size.width * 96,
					size.height * 96
				);
				$('.size-pick').removeClass('selected');
				$el.find('div').addClass('selected');
			});
		};
		var $picker = $('<ul id="work-area-size-pick">');
		var inchToPixel = 10;
		var bookDimensions = this.getBook().dimensions;
		sizes.forEach(function(size) {
			var $li = $('<li>');
			var $div = $('<div>')
				.addClass('size-pick')
				.css( { width: size.width * inchToPixel,
					height: size.height * inchToPixel})
				.text(size.width + " X " + size.height);
			if (bookDimensions.width == size.width * 96 && bookDimensions.height == size.height * 96)
				$div.addClass('selected');
			$li.append($div);
			$picker.append($li);
			assignCb( $li, size );
		});
		return $picker;
	},
	loadThemes: function($picker) {
		var themeIds = ['admin@sports'];

		var themesLoading = false;

		themeIds.forEach( function( id) {
			try {
				PB.ThemeCache.get( id, {autoload: true} );
			}
			catch(ex) {
				if (!themesLoading) {
					window.setTimeout( function() {ThemeWorkArea.loadThemes($picker)}, 0);
					themesLoading = true;
				}
			}
		});

		if (themesLoading)
			return;

		function assignCb( $el, themeId ) {
			$el.on('touchstart mousedown', function() {
				$('.theme-pick').removeClass('selected');
				ThemeWorkArea.getBook().themeId = themeId;
				$el.addClass('selected');
			});
		};

		$picker = $('<ul id="theme-picker">');
		var bookThemeId = this.getBook().themeId;
		themeIds.forEach( function(id) {
			var theme = PB.ThemeCache.get(id, '');
			var $li = $('<li class="theme-pick">');
			$li.append( $('<img>').prop('src', theme.screenshots[0]));
			$li.append( $('<p>').text( theme.title ));
			assignCb( $li, id );
			$picker.append($li);
			if (id == bookThemeId)
				$li.addClass('selected');
		});
		$('#work-area-theme').append($picker);
		// console.log("themes loaded");
	},
	loadThemePicker: function() {
		this.loadThemes();
	},
	getThemePicker: function() {
		var $picker = $('<ul id="theme-picker">');
		this.loadThemes($picker);
		console.log('themes appended');
		return $picker;
	}
}

scope.ThemeWorkArea = ThemeWorkArea;

})(GUI);
