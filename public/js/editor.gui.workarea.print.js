// editor.gui.workarea.print.js

(function(scope) {

var PrintWorkArea = {
	init: function() {
		$('#generate-pdf-btn').on('click', function() {
			PrintWorkArea.generatePdf();
		});
	},
	get book() {
		return PB.Book.default;
	},
	show: function() {
		if (this.book.themeId == null || !this.book.dimensions.width) {
			GUI.Options.designStage = 'theme'
			throw new Error("Cant design before assigning theme/width");
		}
		GUI.Palette.setupPicker([]);
		GUI.WorkArea.Menu.setup([]);
		$('#work-area-print').show();
	},
	hide: function() {
		$('#work-area-print').hide();
	},
	generatePdf: function() {
		var def = PB.Book.Utils.prepareForPrint( this.book );
		var THIS = this;
		def.done( function() {
			$.ajax("/books/" + THIS.book.db_id + "/pdf", {
				type: "POST",
				success: function() {
				},
				error: function(jqXHR, textStatus, errorThrown) {
					PB.error("Unexpected error trying to generate PDF\n" + textStatus);
				}
			});
		});
		def.fail( function() {
			console.warn('book.prepareForPrint failed');
		})

	}
}
scope.PrintWorkArea = PrintWorkArea;
})(GUI);
