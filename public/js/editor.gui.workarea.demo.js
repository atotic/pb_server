// editor.gui.workarea.demo.js

(function(scope) {
var DemoWorkArea = {
	show: function() {
		GUI.Palette.setupPicker([]);
		GUI.WorkArea.Menu.setup([]);
		$('#work-area-demo').show();
	},
	hide: function() {
		$('#work-area-demo').hide();
	},
}

scope.DemoWorkArea = DemoWorkArea;

})(GUI);
