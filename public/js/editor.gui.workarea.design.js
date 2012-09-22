// editor.gui.designworkarea.js

// #work-area-design implementation. Visible in 'Design' mode

(function(scope) {

var ID= '#work-area-design';

var DesignWorkArea = {
	bindToBook: function(book) {
		$(ID)
			.data('model', book)
			.on(PB.MODEL_CHANGED, this.bookChanged);
	},
	get book() {
		return $(ID).data('model');
	},
	bookChanged: function() {
	},
	show: function() {
		$(ID).show();
		if(!this.book.template)
			GUI.Template.append($(ID), 'pick-book-style');
	},
	hide: function() {
		$(ID).hide();
	}
}

scope.DesignWorkArea = DesignWorkArea;

})(GUI);
