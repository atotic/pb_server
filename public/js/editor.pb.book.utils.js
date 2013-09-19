// editor.pb.book.utils.js

(function(scope) {
"use strict";

var Utils = {
	// Prepare book for print
	// In progress: should do comprehensive check for:
	// blank pages, low-resolution images, blank images, images out of bounds, text out of bounds
	// return: deferred
	prepareForPrint: function(book) {
		var deferred = $.Deferred();
		var pageList = book.pageList;
		var fail = false;
		pageList.forEach( function(pageId) {
			var page = book.page(pageId);
			if (!page.designId)
				book.generateDesignId(page);
			if (page.needReflow)
				page.reflow();
		});
		if (fail)
			deferred.reject();
		else
			deferred.resolve();
		return deferred;
	}
}
scope.Utils = Utils;

})(window.PB.Book);
