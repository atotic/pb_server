// editor.gui.workarea.print.js

(function(scope) {

var PrintWorkArea = {
	init: function() {
		$('#generate-pdf-btn').on('click', function() {
			PrintWorkArea.generatePdf();
		});
	},
	show: function() {
		GUI.Palette.setupPicker([]);
		GUI.WorkArea.Menu.setup([]);
		$('#work-area-print').show();
	},
	hide: function() {
		$('#work-area-print').hide();
	},
	generatePdf: function() {
		$.ajax("/books/" + PB.Book.default.db_id + "/pdf", {
			type: "POST",
			success: function() {
			},
			error: function(jqXHR, textStatus, errorThrown) {
				PB.error("Unexpected error trying to generate PDF\n" + textStatus);
			}
		});

	}
}
scope.PrintWorkArea = PrintWorkArea;
})(GUI);
