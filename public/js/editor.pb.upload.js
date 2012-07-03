// editor.pb.upload.js

/*
	Uploading:
	every book is document + change id
*/
(function(scope) {
	var Uploader = {
		bookQueue: [],
		bookActiveRequest: null,
		saveBook: function(book) {
			if (this.bookQueue.indexOf(book) == -1)
				this.bookQueue.push(book);
			this.processQueue();
		},
		saveAll: function() {
			var dirty = PB.Book.getDirty();
			for (var i=0; i < dirty.length; i++)
				Uploader.saveBook(dirty[i]);
		},
		processQueue: function() {
			if (this.bookQueue.length == 0 || this.bookActiveRequest)
				return;
			var book = this.bookQueue.pop();
			this.bookActiveRequest = book.getSaveDeferred();
			if (!this.bookActiveRequest) {
				this.processQueue();
				return;
			}
			var THIS = this;
			this.bookActiveRequest
				.done( function(response, msg, jqXHR) {
					console.log("ajax done");
				})
				.fail( function() {
					console.log("ajax fail");
				})
				.always( function() {
					console.log('ajax always');
					THIS.bookActiveRequest = null;
					THIS.processQueue();
				});
		}
	}

	// Save modified books every minute.
	window.setInterval( Uploader.saveAll, 1*1000);

	scope.Uploader = {
		saveBook: Uploader.saveBook
	}
})(PB);
