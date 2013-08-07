// editor.gui.workarea.print.js

(function(scope) {

var PrintWorkArea = {
	show: function() {
		GUI.Palette.setupPicker([]);
		$('#work-area-print').show();
		GUI.WorkArea.Menu.setup([]);
	},
	hide: function() {
		$('#work-area-print').hide();
	}
}
scope.PrintWorkArea = PrintWorkArea;
})(GUI);
