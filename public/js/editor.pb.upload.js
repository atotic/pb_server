// editor.pb.upload.js

/*
	Uploader:
	saves book every SaveInterval seconds
*/
(function(scope) {
	var Uploader = {
		bookQueue: [],
		bookActiveRequest: null,
		hasRequests: function() {
			return this.bookQueue.length > 0 || this.bookActiveRequest;
		},
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
	var SaveInterval = 1;	// Save interval (seconds)

	// Save modified books every second.
	window.setInterval( Uploader.saveAll, SaveInterval*1000);

	scope.Uploader = {
		saveBook: Uploader.saveBook
	}

	// Save before navigating away
	window.onbeforeunload = function(e) {
		Uploader.saveAll();
		if (Uploader.hasRequests()) {
			var msg = "You have unsaved changes. Are you sure that you want to leave the page?";
			if (e)
				e.returnValue = msg;
			return msg;
		}
	};

})(PB);

/* DiffStream
 * every book listens to diffs from the stream
 */
(function(scope){
	var DiffStream = {
		init: function() {
		},
		url: function(book) {
			return "/subscribe/book/" + book.id + "?last_diff=" + book.last_diff;
		},
		handleMessage: function(book, message) {
			switch(message.type) {
			case "StreamUpToDate":
				break;
			case "Patch":
				break;
			}
		},
		connect: function(book) {
			var stream = $.stream(this.url(book), {
				context: this,
				dataType: 'json',
				type: 'http',
				reconnect: false,	// we'll handle reconnect
				handleSend: function() { // no talking back to the server
					return false;
				},
				// Lifecycle callbacks
				open: function(event, stream) {
					console.log("ServerStream opened " + stream.id);
				},
				message: function(ev) {
					console.log("Server stream message " + stream.id)
					DiffStream.handleMessage(book, ev.data);
				},
				error: function(ev) {
					console.log("serverStream error , possible closure " + stream.id);
				},
				close: function(ev) {
					console.warn("server connection closed");
					book.stream = null;
				}
			});
			return stream;

		}
	}
	scope.DiffStream = DiffStream;
})(PB);

