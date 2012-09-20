// editor.gui.workarea.js

(function(scope) {

var WorkArea = {
	bindToBook: function(book) {
		GUI.Options.addListener(this.optionsChanged);
		GUI.RoughWorkArea.bindToBook(book);
		this.optionsChanged('designStage', GUI.Options.designStage);
	},
	optionsChanged: function(name, val) {
		if (name == 'designStage')
			switch(val) {
				case 'organize':
					WorkArea.show('work-area-rough');
					break;
				case 'design':
					WorkArea.show('work-area-design');
					break;
				case 'print':
					WorkArea.show('work-area-print');
					break;
				default:
					console.warn("unknown designStage", val);
			}
	},
	get visibleWorkAreaId() {
		var area = $('#work-area-rough:visible, #work-area-design:visible, #work-area-print:visible');
		if (area.length == 1)
			return area.get(0).id;
		return null;
	},
	areaIdToObject: function(areaId) {
		switch(areaId) {
			case 'work-area-rough':
				return GUI.RoughWorkArea;
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
			showArea.show();
			$('#' + showId + '-nav').addClass('active');
			GUI.fixSizes();
		}
	}
};
scope.WorkArea = WorkArea;
})(GUI);
