// editor.gui.workarea.js

(function(scope) {

var WorkArea = {
	init: function() {
		$('#work-area').data('resize', function() {
			var paletteHeight = $('#palette:visible').length == 1 ? $('#palette').outerHeight() : 0;
			var h = $('body').height() - $('#top-menu').height() - paletteHeight;
			$('#work-area').css('height', h);
			$('#work-area-container').css('height', h - parseInt($('#work-area').css('padding-top')));
			GUI.Buttons.ResizePaletteButton.fixPosition();
		});
		GUI.DesignWorkArea.init();
	},
	bindToBook: function(book) {
		GUI.Options.addListener(this.optionsChanged);
		GUI.RoughWorkArea.bindToBook(book);
		GUI.DesignWorkArea.bindToBook(book);
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
			case 'work-area-design':
				return GUI.DesignWorkArea;
			case 'work-area-print':
				return GUI.PrintWorkArea;
			case 'work-area-theme':
				return GUI.ThemeWorkArea;
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
			showArea.show();
			$('#' + showId + '-nav').addClass('active');
			GUI.fixSizes($('#work-area'));
		}
	}
};
scope.WorkArea = WorkArea;
})(GUI);
