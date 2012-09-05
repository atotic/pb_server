// editor.gui.tools.js

(function(scope) {
"use strict";
	var buttonMap = [
	{ name: 'photoFilter', value: 'all'},
	{ name: 'photoFilter', value: 'unused'},
	{ name: 'photoSort', value: 'added'},
	{ name: 'photoSort', value: 'taken'},
	{ name: 'photoSort', value: 'name'},
	{ name: 'photoSize', value: 'small'},
	{ name: 'photoSize', value: 'medium'},
	{ name: 'photoSize', value: 'large'},
	{ name: 'pageSize', value: 'small'},
	{ name: 'pageSize', value: 'medium'},
	{ name: 'pageSize', value: 'large'}
	];

	var Tools = {
		init: function() {
			for (var i=0; i<buttonMap.length; i++) {
				var btn = this.buttonFromNameVal(buttonMap[i]);
				btn.click(this.buttonMapClick);
			}
			$('#tool-addLocalFile').click( function(ev) {
				$('#add-photo-input').click();
				$('#rough-more-tools').hide();
				ev.preventDefault();
			});
		},
		// click event callback
		buttonMapClick: function(ev) {
			ev.preventDefault();
			var match = this.id.match(/([^-]*)-(.*)/);
			if (!match)
				return console.warn("buttonMapClick could not match id");
			$('#rough-more-tools').hide();
			GUI.Options[ match[1] ] = match[2];
		},
		buttonFromNameVal: function(nameVal) {
			var id = nameVal.name + "-" + nameVal.value;
			var btn = $('#' + id);
			if (btn.length == 0)
				console.error("unknown button ", id);
			return btn;
		},
		loadFromOptions: function() {
			for (var i=0; i< buttonMap.length; i++) {
				var btn = this.buttonFromNameVal( buttonMap[i] );
				if (GUI.Options[ buttonMap[i].name ] == buttonMap[i].value)
					btn.addClass('active');
				else
					btn.removeClass('active');
			}
		}
	}
	scope.Tools = Tools;
})(GUI);
