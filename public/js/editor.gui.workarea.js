// editor.gui.workarea.js

(function(scope) {

"use strict"

var WorkArea = {
	init: function() {
		['organize', 'theme', 'design', 'print'].forEach(function(action) {
			var id = 'work-area-' + action + '-nav';
			$('#' + id).on('mousedown touchstart', function() {
							GUI.Options.designStage = action;
						})
						.find('a').on('click', function(ev) { ev.preventDefault() });
		});
		$('#work-area').data('resize', function() {
			var paletteHeight = $('#palette:visible').length == 1 ? $('#palette').outerHeight() : 0;
			var h = $('body').height() - $('#site-navbar').height() - $('#top-navbar').height() - $('#bottom-navbar').height() - paletteHeight;
			$('#work-area').css('height', h);
			$('#work-area-container').css('height', h - parseInt($('#work-area').css('padding-top')));
			GUI.Buttons.ResizePaletteButton.fixPosition();
		});
		GUI.DesignWorkArea.init();
		GUI.PrintWorkArea.init();
		WorkAreaMenu.init();
	},
	bindToBook: function(book) {
		GUI.Options.addListener(this.optionsChanged);
		GUI.RoughWorkArea.bindToBook(book);
		GUI.DesignWorkArea.bindToBook(book);
		$('#work-area-organize').hide();
		this.optionsChanged('designStage', GUI.Options.designStage);
	},
	optionsChanged: function(name, val) {
		if (name == 'designStage')
			switch(val) {
			case 'organize':
				WorkArea.show('work-area-organize');
			break;
			case 'theme':
				WorkArea.show('work-area-theme');
			break;
			case 'design':
				WorkArea.show('work-area-design');
			break;
			case 'print':
				WorkArea.show('work-area-print');
			break;
			default:
				console.warn("unknown designStage", val);
			break;
			}
	},
	get visibleWorkAreaId() {
		var area = $('#work-area-organize:visible, #work-area-theme:visible, #work-area-design:visible, #work-area-print:visible');
		if (area.length == 1)
			return area.get(0).id;
		return null;
	},
	areaIdToObject: function(areaId) {
		switch(areaId) {
			case 'work-area-organize':
				return GUI.RoughWorkArea;
			case 'work-area-theme':
				return GUI.ThemeWorkArea;
			case 'work-area-design':
				return GUI.DesignWorkArea;
			case 'work-area-print':
				return GUI.PrintWorkArea;
			default:
				return null;
		}
	},
	show: function(showId) {
		var showArea = this.areaIdToObject(showId);
		var hideId = this.visibleWorkAreaId;
		var hideArea = this.areaIdToObject(hideId);
		if (showArea == hideArea)
			return;
		if (hideArea) {
			hideArea.hide();
			$('#' + hideId + '-nav').removeClass('active');
		}
		if (showArea) {
			try {
				showArea.show();
				$('#' + showId + '-nav').addClass('active');
				GUI.fixSizes($('#work-area'));
			}
			catch(ex) { // if area is not ready to show, it will throw exception
				$('#' + showId + '-nav').removeClass('active');
			}
		}
	}
};

var TrashDroppable = new GUI.Dnd.Droppable( {
	flavors: [
		'page',	// transferData: transferData: pageModelId
		'photo', // transferData: serverPhotoId
		'photoInRoughPage', // transferData: assetId
		'photoInPage'	// transferData: { page: p, assetId: id }
	],
	enter: function( $dom, flavor, transferData) {
		this.dom = $dom;
		this.dom.addClass('drop-target');
	},
	leave: function( transferDone ) {
		this.dom.removeClass('drop-target');
	},
	putTransferData: function($ev, flavor, transferData) {
		switch(flavor) {
		case 'page':
			PB.ModelMap.model(transferData).remove({animate:true});
		break;
		case 'photo':
			var book = PB.Book.default;
			var bookPhoto = book.photo( book.bookPhotoId( transferData ));
			book.removePhoto( bookPhoto, { animate: true } );
		break;
		case 'photoInRoughPage':
			var pageAsset = PB.ModelMap.model( transferData);
			pageAsset.page.removeAsset( pageAsset.assetId, { animate: true });
		break;
		case 'photoInPage':
			transferData.page.removeAsset( transferData.assetId );
		break;
		}
	}
});

var AddPageDraggableOptions = {
	flavors: [
		'newPage' // transferData: null
	],
	getTransferData: function($src, flavor) {
		return null;
	},
	isTouch: false,
	start: function( $el, $ev, startLoc ) {
//			console.log('start', $ev.type );
		this.isTouch = this.isTouch || ($ev.type == 'touchstart');
		this.startTime = Date.now();
		var bounds = $el[0].getBoundingClientRect();
		var $dom = GUI.Util.cloneDomWithCanvas($el)
			.addClass('touch-drag-src')
			.css( {
				top: startLoc.y,
				left: startLoc.x,
				marginLeft: bounds.left + $(document).scrollLeft() - startLoc.x,
				marginTop: bounds.top + $(document).scrollTop() - startLoc.y + 10,
				position: 'absolute'
			});
		var anchorStyling = window.getComputedStyle($el.find('a')[0]);
		$dom.find('a').css({
			paddingTop: anchorStyling.paddingTop,
			paddingLeft: anchorStyling.paddingLeft,
			paddingBottom: anchorStyling.paddingBottom,
			paddingRight: anchorStyling.paddingRight,
			color: anchorStyling.color,
			textDecoration: anchorStyling.textDecoration,
			textShadow: anchorStyling.textShadow
		});
		//	$dom.children().css('verticalAlign', 'top'); // eliminate LI whitespace
		return $dom;
	},
	end: function(transferDone, $ev) {
		var diff = Date.now() - this.startTime;
		if (diff > 300)
			this.isTouch = false;

		if ( this.isTouch && $ev.type == 'mouseup') // prevents double action when mouse & touch fire together
			return;
		console.log('end');
		var diff = Date.now() - this.startTime;
		if (!transferDone && diff < 300)
			PB.Book.default.addPage( -1, { animate: true });
	},
}

var buttons = [
	{ title: 'add photo', id: 'add-photo-btn' },
	{ title: 'add page', id: 'add-page-btn', rel: 'You can DRAG the button to insert pages in the middle' },
	{ title: 'add text', id: 'add-text-btn' },
	{ title: 'trash', id: 'trash-btn'}
]
// GUI.WorkArea.Menu.setup(['add-photo-btn', 'add-page-btn', 'add-text-btn']);
var WorkAreaMenu = {
	init: function() {
		// Trash
		$('#trash-btn').addClass('pb-droppable')
			.data( 'pb-droppable', TrashDroppable );
		// Add page
		$('#add-page-btn').addClass('pb-draggable')
			.data( 'pb-draggable', new GUI.Dnd.Draggable( AddPageDraggableOptions));
		GUI.Dnd.Util.preventDefaultDrag($('#add-page-btn'));
		// Add photo
		$('#add-photo-btn')
			.on('mousedown touchstart', function() {
				$('#add-photo-input').click();
			})
			.children('a').on('click', function(ev) {
				// $('#add-photo-input').click();
				ev.preventDefault();
			});
		$("#add-photo-input").on( {
			change: function(e) {
				for (var i=0; i<this.files.length; i++)
					PB.Book.default.addLocalPhoto(this.files[i], {animate:true});
		}});

	},
	setup: function(allowedButtons) {
		buttons.forEach(function(b) {
			if (allowedButtons.indexOf(b.id) == -1)
				$('#'+b.id).hide();
			else
				$('#'+b.id).show();
		});
	}
}
scope.WorkArea = WorkArea;
scope.WorkArea.Menu = WorkAreaMenu;
})(GUI);
