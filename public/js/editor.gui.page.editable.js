// editor.gui.page.editable.js

(function(scope) {

	var PageDroppable = new GUI.Dnd.Droppable({
		flavors: ['background', 'layout', 'widget'],
		enter: function($dom, flavor, transferData) {
			this.page = PB.Page.Selection.findClosest($dom).bookPage;
			this.dom = $dom;
			this.dropFlavor = flavor;
			switch( this.dropFlavor ) {
				case 'background':
					this.oldBackground = this.page.p.backgroundId;
					this.oldBackgroundData = this.page.p.backgroundData;
					this.page.setBackground(transferData);
				break;
				case 'layout':
					this.oldLayout = this.page.p.layoutId;
					this.oldLayoutData = this.page.p.layoutData;
					this.page.setLayout( transferData);
				break;
				case 'widget':
					this.dom.addClass('drop-target');
				break;
				default:
					console.error('unknown drop flavor', this.dropFlavor );
				break;
			};
		},
		leave: function() {
			switch( this.dropFlavor ) {
				case 'background':
				 	if ('oldBackground' in this)
						this.page.setBackground( this.oldBackground, this.oldBackgroundData );
				break;
				case 'layout':
					if ('oldLayout' in this)
						this.page.setLayout(this.oldLayout, this.oldLayoutData);
				break;
				case 'widget':
					this.dom.removeClass('drop-target');
				break;
			}
		},
		putTransferData: function( $ev, flavor, transferData ) {
			switch( this.dropFlavor ) {
				case 'background':
					this.page.setBackground( transferData );
					delete this.oldBackground;
				break;
				case 'layout':
					this.page.setLayout( transferData );
					delete this.oldLayout;
				break;
				case 'widget':
					var loc = GUI.Util.getPageLocation($ev);
					var pageBounds = this.dom[0].getBoundingClientRect();
					var widget = PB.ThemeCache.resource(transferData);
					this.page.addAsset( {
						type: 'widget',
						widgetId: transferData,
						top: loc.y - widget.height() / 2 - (pageBounds.top + window.scrollY),
						left: loc.x - widget.width() / 2 - (pageBounds.left + window.scrollX),
						width: widget.width(),
						height: widget.height()
					});
				break;
			}
		}
	});

	var BackgroundDraggableOptions = {
		flavors: ['background'],
		backgroundId: 'your background id here',
		getTransferData: function(ev, $src, flavor) {
			return this.backgroundId;
		}
	}

	var LayoutDraggableOptions = {
		flavors: ['layout'],
		layoutId: 'your id here',
		getTransferData: function(ev, $src, flavor) {
			return this.layoutId;
		}
	}

	var WidgetDraggableOptions = {
		flavors: ['widget'],
		widgetId: 'your id here',
		start: function($el, ev, startLoc) {
			var widget = PB.ThemeCache.resource(this.widgetId);
			var maxDim = 300;
			var width = widget.width();
			var height = widget.height();
			var scale = Math.min( maxDim/width, maxDim/height);
			if (scale < 1) {
				width *= scale;
				height *= scale;
			}
			var $widgetDom = widget.generateDom( width, height, {}, {resolution: PB.PhotoProxy.DISPLAY });
			var $dom = $('<div>').append($widgetDom);
			$dom.addClass('touch-drag-src')
				.css( {
					top: startLoc.y,
					left: startLoc.x,
					marginLeft: -width / 2,
					marginTop: -height / 2
				});
			$dom.find('img').on('dragstart', function(ev) { ev.preventDefault(); return false;});
			return $dom;
		},
		getTransferData: function(ev, $src, flavor) {
			return this.widgetId;
		}
	}
	scope.Page.Editor = {
		Droppable: {
			Page: PageDroppable,
		},
		DraggableOptions: {
			Background: BackgroundDraggableOptions,
			Layout: LayoutDraggableOptions,
			Widget: WidgetDraggableOptions
		}
	}

})(PB);
