// editor.gui.workarea.js

(function(scope) {

var WorkArea = {
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
