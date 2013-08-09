// editor.gui.palette.themepicker.js

(function(scope) {
"use strict";

var themes = [
	{ id: 'admin@sports' },
	{ id: 'admin@modern_full' }
];

var ThemePicker = {
	init: function() {
		$('#palette-themepicker')
			.on('pbShow', function() {
				ThemePicker.processDelayUntilVisible();
				ThemePicker.onShow();
			});

	},
	createThemeTiles: function() {
		// preload themes
		var themesLoading = false;
		themes.forEach( function( t ) {
			try {
				PB.ThemeCache.get( t.id, {autoload: true} );
			}
			catch(ex) {
				if (!themesLoading) {
					window.setTimeout( function() {ThemePicker.createThemeTiles()}, 0);
					themesLoading = true;
				}
			}
		});
		if (themesLoading)
			return;
		var $picker = $('#palette-themepicker');
		themes.forEach( function(t) {
			var theme = PB.ThemeCache.get(t.id);
			var $t = $('<div>')
				.addClass('palette-theme-tile')
				.on('touchstart mousedown', function() {
					window.setTimeout(function() {
						GUI.Palette.Theme.setTheme(t.id);
						GUI.Palette.select('theme');
					}, 0);
				});
			$t.append( $('<img>').prop('src', theme.screenshots[0]));
			$picker.append($t);
		});
	},
	onShow: function() {
		if ($('#palette-themepicker').find('.palette-theme-tile').length == 0)
			this.createThemeTiles();
	}
}

$.extend(ThemePicker, GUI.Mixin.DelayUntilVisible);

scope.ThemePicker = ThemePicker;

})(GUI.Palette);
