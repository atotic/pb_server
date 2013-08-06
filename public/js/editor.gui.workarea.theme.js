// editor.gui.workarea.theme.js

(function(scope) {
"use strict"

var DPI = 96;

var ThemeWorkArea = {
	getBook: function() {
		return PB.ModelMap.model( $('body').data('model_id') );
	},
	show: function() {
		$('#work-area').addClass('theme');
		var $dom = $('#work-area-theme');
		$dom.show();
		$dom.append( this.getSizePicker(PB.Book.default));
		this.loadThemePicker();
		GUI.Palette.setupPicker([]);
		$('#workarea-menu').find('li').hide();
	},
	hide: function() {
		$('#work-area').removeClass('theme');
		$('#work-area-theme').hide();
		$('#work-area-size-pick').remove();
		$('#theme-picker').remove();
	},
	updateSizePickerSelection: function($picker) {
		var book  = PB.ModelMap.domToModel($picker);
		var bookDims = book.dimensions;
		$picker.find('.size-pick').each( function() {
			var $this = $(this);
			var dims = $this.data('dimensions');
			if (dims.width * DPI == bookDims.width
				&& dims.height * DPI == bookDims.height)
				$this.addClass('selected');
			else
				$this.removeClass('selected');
		});
	},
	pickerModelChanged: function(ev, model, prop, options) {
		if (prop == 'dimensions')
			ThemeWorkArea.updateSizePickerSelection($('#work-area-size-pick'));
	},
	getSizePicker: function(book) {
		var sizes = [	// inches
			{ width: 7, height: 5},
			{ width: 4, height: 4 },
			{ width: 8, height: 8 },
			{ width: 12, height: 12},
			{ width: 11, height: 8 }
		];
		function assignCb($el) {
			$el.on('touchstart mousedown', function() {
				var dims = $(this).find('.size-pick').data('dimensions');
				ThemeWorkArea.getBook().setDimensions( {
					width: dims.width * DPI,
					height: dims.height * DPI
				});
			});
		};
		var $picker = $('<ul id="work-area-size-pick">')
			.data('model_id', book.id)
			.on( PB.MODEL_CHANGED, this.pickerModelChanged);
		var inchToPixel = 10;
		var bookDimensions = this.getBook().dimensions;
		sizes.forEach(function(size) {
			var $li = $('<li>');
			var $div = $('<div>')
				.addClass('size-pick')
				.data('dimensions', size)
				.css( { width: size.width * inchToPixel,
					height: size.height * inchToPixel})
				.text(size.width + " X " + size.height);
			$li.append($div);
			$picker.append($li);
			assignCb( $li );
		});
		this.updateSizePickerSelection($picker);
		return $picker;
	},
	loadThemes: function($picker) {
		var themeIds = ['admin@sports', 'admin@modern_full'];

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
