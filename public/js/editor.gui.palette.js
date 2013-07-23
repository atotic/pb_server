// editor.gui.palette.js
// Palette ids:
// navigation: #palette-<token>-nav
// palette:
// 	#palette-<token>-container
//     #palette-<token>
// Current palettes:
// bookphoto
// theme
// themepicker
(function(scope) {
"use strict";

var palettes = [
	{ title: 'Book photos', id: 'bookphoto'},
	{ title: 'Theme', id: 'theme'},
	{ title: 'Change Theme', id: 'themepicker'}
]
var Palette = {
	init: function() {
		var $kindPicker = $('#palette-kind-picker');
		var $paletteHolder = $('#palette');
		var THIS = this;
		palettes.forEach( function(p) {
			// create palette
			var $container = $('<div>')
				.prop('id', THIS.paletteContainerId( p.id ))
				.addClass('palette-container');
			var $palette = $('<div>')
				.prop('id', THIS.paletteId( p.id ))
				.addClass('palette-content');
			$container.append( $palette );
			$paletteHolder.append( $container );

			// create picker menu item
			var $li = $('<li>')
				.prop('id', THIS.paletteMenuitemId(p.id))
				.text(p.title);
			$kindPicker.append($li);
			$li.on('mousedown touchstart', function() {
				Palette.select(p.id);
			});
		});
		GUI.Palette.Theme.init();
	},
	bindToBook: function(book) {
		GUI.Palette.BookPhoto.bindToBook( book );
		GUI.Palette.Theme.bindToBook( book );
		GUI.Palette.Theme.bindToWorkarea( GUI.DesignWorkArea);
	},
	setupPicker: function( allowedPalettes ) {
		var $kindPicker = $('#palette-kind-picker');
		var THIS = this;
		palettes.forEach( function(p) {
			var id = THIS.paletteMenuitemId(p.id);
			if ( allowedPalettes.indexOf(p.id) == -1)
				$('#'+id).hide();
			else {
				$('#'+id).show();
			}
		});
		if ( allowedPalettes.length == 0)
			this.select("");
	},
	select: function( paletteId ) {
		if (!paletteId) paletteId = 'none';
		var targetId = this.paletteContainerId( paletteId );
		var THIS = this;
		$('#palette').find('.palette-container').each(function() {
			if (this.id == targetId) {
				$(this)
					.show()
					.find('*').trigger('pbShow')
					.end()
					.find( '#' + THIS.paletteId( paletteId ) )
					.prepend($('#palette-kind-picker'))
			}
			else
				$(this).hide();
		});
		if (paletteId == 'none')
			$('#palette-kind-picker').hide();
		else
			$('#palette-kind-picker').show();
		$('#palette-kind-picker').find('li').removeClass('menuselected');
		$( '#' + this.paletteMenuitemId(paletteId) ).addClass('menuselected');
		GUI.fixSizes($('#work-area'));
	},
	paletteId: function( paletteId) {
		return 'palette-' + paletteId;
	},
	paletteMenuitemId: function(paletteId) {
		return 'palette-' + paletteId + '-menuitem';
	},
	paletteContainerId: function(paletteId) {
		return 'palette-' + paletteId + '-container';
	},
	currentPaletteRegex: /palette-([^-]+)-container/,
	getCurrentPaletteId: function() {
		var $cur = $('#palette').find('.palette-container:visible');
		var domId = $cur.prop('id');
		var match = this.currentPaletteRegex.exec( domId );
		if (match.length == 2)
			return match[1];
		return "";
	},
	getPossibleHeights: function() {
		var max = $('#main-content').height() - GUI.Options.pageSizePixels - 32;
		var paletteId = this.getCurrentPaletteId();
		var heights;
		switch(paletteId) {
			case 'bookphoto':
				heights = GUI.Palette.BookPhoto.getPossibleHeights(max);
			break;
			default:
				heights = {
					top: 0,
					bottom: 0,
					heights: [128, $('#' + this.paletteId( paletteId )).outerHeight()]
				}
		}
		var palette = $('#palette');
		var topExtra = heights.top + parseInt(palette.css('padding-top'));
		var bottomExtra = heights.bottom + parseInt(palette.css('padding-bottom'));
		return heights.heights.map(function(x) { return x + topExtra + bottomExtra;});
	},
	setHeight: function(height, animate) {
		var palette = $('#palette');
		var padding = parseInt(palette.css('padding-top')) + parseInt(palette.css('padding-bottom'));
		var containerHeight = height - padding;
		$('#palette').find('.palette-container').css( {minHeight: containerHeight, maxHeight: containerHeight});
		GUI.fixSizes($('#work-area'));
	},
	viewMore: function() {
		var heights = this.getPossibleHeights();
		var height = $('#palette').outerHeight();
		for (var i=0; i<heights.length; i++)
			if (heights[i] > height)
				return this.setHeight(heights[i], true);
	},
	viewLess: function() {
		var heights = this.getPossibleHeights();
		var height = $('#palette').outerHeight();
		for (var i=heights.length-1; i>=0; i--)
			if (heights[i] < height)
				return this.setHeight(heights[i], true);
	}
}

scope.Palette = Palette;
})(GUI);
