// editor.gui.palette.theme.js

(function(scope) {

var DefaultThemeId = 'admin@sports';

var ThemePalette = {
	currentThemeId: null,
	init: function() {
		$('#palette-theme').on('pbShow', function() {
			if ( !ThemePalette.currentThemeId )
				ThemePalette.setTheme( DefaultThemeId );
			ThemePalette.processDelayUntilVisible();
		});
	},
	bindToBook: function( book ) {
		this.book = book;
		$('#palette-theme').data('model_id', book.id)
			.on(PB.MODEL_CHANGED,
				function(ev, model, prop, options) {
					switch( prop ) {
					case 'dimensions':
						ThemePalette.setTheme( ThemePalette.currentThemeId, { force: true });
					break;
					}
				})
	},
	bindToWorkarea: function( workarea ) {
		this.workarea = workarea;
	},
	processDelayUntilVisible: function() {
	},
	createDesignTiles: function(theme, tileHeight, page) {
		if (page == null)
			return [];
		var retVal = [];
		for (x in theme.designs) {
			var designId = 'theme://' + theme.id + "/designs/" + x;
			var $icon = $(PB.ThemeUtils.getDesignIcon( page, tileHeight, {designId: designId } ));
			var designOptions = $.extend( {},
				PB.Page.Editor.DraggableOptions.Design,
				{designId: designId});
			$icon.addClass('pb-draggable')
				.data('pb-draggable', new GUI.Dnd.Draggable( designOptions));
				GUI.Dnd.Util.preventDefaultDrag($icon);
			retVal.push($icon);
		}
		return retVal;
	},
	createBackgroundTiles: function( theme, tileHeight, whRatio) {
		var retVal = [];
		for (var x in theme.backgrounds) {
			var $div = $('<div>')
				.css({
					width: tileHeight * whRatio,
					height: tileHeight
				});
			;
			theme.backgrounds[x].fillBackground($div, null, {resolution: PB.PhotoProxy.SMALL});
			var dragOptions = $.extend( {},
				PB.Page.Editor.DraggableOptions.Background,
				{ backgroundId: 'theme://' + theme.id + '/backgrounds/' + x
				});
			$div.addClass('pb-draggable')
				.data('pb-draggable', new GUI.Dnd.Draggable( dragOptions ));
			retVal.push($div);
		}
		return retVal;
	},
	createLayoutTiles: function(theme, tileHeight, page) {
		// TODO eliminate duplicates
		var retVal = [];
		for (var x in theme.designs) {
			var icon = PB.ThemeUtils.getDesignIcon( page, tileHeight,
				{
					designId: 'theme://' + theme.id + '/designs/' + x,
					layoutOnly: true
				});
			var dragOptions = $.extend( {},
				PB.Page.Editor.DraggableOptions.Layout,
				{ layoutId: 'theme://' + theme.id + '/designs/' + x }
			);
			var $div = $('<div>').append(icon);
			$div.addClass('pb-draggable')
				.data('pb-draggable', new GUI.Dnd.Draggable( dragOptions));
			retVal.push( $div );
		};
		return retVal;
	},
	createWidgetTiles: function(theme, tileHeight) {
		var retVal = [];
		for (var x in theme.widgets) {
			var maxWidth = tileHeight * 2;
			var width = theme.widgets[x].width();
			var height = theme.widgets[x].height();
			var r = tileHeight / height;
			var r2 = maxWidth / width;
			r = Math.min( r, r2);
			if (r < 1 ) {
				width *= r; height *=r;
			}
			var tile = theme.widgets[x].generateDom(
				width, height, {}, {resolution: PB.PhotoProxy.SMALL });
			tile.css({
			 	verticalAlign: 'baseline'
			 });
			var dragOptions = $.extend( {},
				PB.Page.Editor.DraggableOptions.Widget,
				{ widgetId: 'theme://' + theme.id + '/widgets/' + x }
				);
			var $div = $('<div>').append(tile);
			$div.addClass('pb-draggable')
				.data('pb-draggable', new GUI.Dnd.Draggable( dragOptions ))
				.css('background', 'transparent');
			GUI.Dnd.Util.preventDefaultDrag($div);
			retVal.push($div);
		}
		return retVal;
	},
	createFrameTiles: function(theme, tileHeight) {
		var retVal = [];
		for (var x in theme.frames) {
			var tileWidth = tileHeight * 3 / 4;
			var $frameDiv = $('<div>').css({
				width: tileWidth,
				height: tileHeight,
				position: 'relative'
			});
			theme.frames[x].fillFrame( $frameDiv,
				{},
				{ resolution: PB.PhotoProxy.SMALL }
			);
			var imgRect = GUI.Rect.create(
				{ width: tileWidth, height: tileHeight })
				.inset( theme.frames[x].getInset() );
			$frameDiv.append( $('<div>').css(
				{
					top: imgRect.top,
					left: imgRect.left,
					width: imgRect.width,
					height: imgRect.height,
					position: 'relative',
					backgroundColor: 'white'
				}
				));
			var frameOptions = $.extend({},
				PB.Page.Editor.DraggableOptions.Frame,
				{ frameId: 'theme://' + theme.id + '/frames/' + x});
			$frameDiv.addClass('pb-draggable')
				.data('pb-draggable', new GUI.Dnd.Draggable( frameOptions ));
			retVal.push($frameDiv);
		}
		return retVal;
	},
	clear: function() {
		$('#palette-theme').find('.palette-tile').remove();
	},
	syncToTheme: function( theme ) {
		function appendTiles(title, tileArray, noBR) {
			var $title = $('<div>')
				.addClass('palette-title-tile')
				.text(title + ' ');
			$title.append( $('<i>').addClass('icon-arrow-right'));
			if (!noBR)
				palette.append('<br>');
			palette.append($title);
			tileArray.forEach( function(tile)  {
				$(tile).addClass('palette-tile');
				palette.append(tile);
			});
		}
		var palette = $('#palette-theme');
		this.clear();
		var dimensions = this.book.dimensions;
		var tileHeight = 96;
		var page = this.workarea.currentModel;
		var tiles = this.createDesignTiles( theme, tileHeight, page);
		appendTiles( 'designs', tiles, true );
		tiles = this.createBackgroundTiles( theme, tileHeight, dimensions.width / dimensions.height );
		appendTiles( 'backgrounds', tiles );
		tiles = this.createLayoutTiles( theme, tileHeight, page );
		appendTiles( 'layouts', tiles );
		tiles = this.createWidgetTiles( theme, tileHeight );
		appendTiles( 'widgets', tiles );
		tiles = this.createFrameTiles( theme, tileHeight );
		appendTiles( 'frames', tiles );
	},
	failedToLoad: function( themeId, message ) {
		this.clear();
		var $errDiv = $('<div class="themeTile">').text( themeId + ' failed to load. ' + message);
		$('#palette-theme').append($errDiv);
	},
	setTheme: function( themeId, options) {
		options = $.extend( {
			force: false
		}, options)
		if (themeId == this.currentThemeId && !options.force)
			return;
		var THIS = this;
		try {
			var theme = PB.ThemeCache.get( themeId , { autoload: false });
			this.currentThemeId = themeId;
			this.syncToTheme( theme );
		}
		catch(ex) {
			PB.ThemeCache.load( PB.ThemeCache.themeUrlFromId( themeId ))
				.done( function() {
					THIS.setTheme( themeId)
				})
				.fail( function( jqXHR, status, msg) {
					THIS.failedToLoad( themeId, msg);
				});
		}
	}
}

GUI.Palette.Theme = ThemePalette;
})(GUI);
