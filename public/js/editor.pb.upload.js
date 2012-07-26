// editor.pb.upload.js

/*
	Uploader:
	saves book every SaveInterval seconds
*/
(function(scope) {

	var INITIAL_RETRY_INTERVAL = 1;	// How often to retry (seconds)
	var MAX_RETRY = 60;	// Maximum retry in seconds
	var SAVE_INTERVAL = 1;	// Save interval (seconds)

	// NetworkErrorRetry is used by Uploader, DiffStream
	// to backoff when network errors occur
	var NetworkErrorRetry = {
		retryAt: 0,
		retryInterval: INITIAL_RETRY_INTERVAL,
		retryLater: function() {
			this.retryAt = Date.now() + this.retryInterval * 1000;
			this.retryInterval = Math.min(this.retryInterval * 2, MAX_RETRY);
		},
		resetRetry: function() {
			this.retryAt = 0;
			this.retryInterval = INITIAL_RETRY_INTERVAL;
		},
		retryOk: function() {
			return Date.now() > this.retryAt;
		},
		retryNow: function() {
			this.resetRetry();
		},
		wentOffline: function() {
			this.retryInterval = MAX_RETRY;
			this.retryLater();
		},
		// When will next retry fire
		get whenToRetry() {
			return Math.max(0, this.retryAt - Date.now());
		}
	}

	window.ononline = function(e) {
		NetworkErrorRetry.resetRetry();
	}

	window.onoffline = function(e) {
		NetworkErrorRetry.wentOffline();
	}


	var Uploader = {
		bookQueue: [],
		photoQueue: [],
		activeRequest: null,
		hasRequests: function() {
			return this.bookQueue.length > 0 || this.activeRequest;
		},
		savePhoto: function(photo) {
			var idx = this.photoQueue.indexOf(photo) ;
			if (idx == -1)
				this.photoQueue.push(photo);
			this.processQueue();
		},
		saveBook: function(book) {
			var idx = this.bookQueue.indexOf(book) ;
			if (idx == -1 && !book.locked)
				this.bookQueue.push(book);
			else if (idx != -1 && book.locked) // remove locked books from queue
				this.bookQueue.splice(idx, 1);
			this.processQueue();
		},
		saveAll: function() {
			var dirty = PB.Book.getDirty();
			for (var i=0; i < dirty.length; i++)
				Uploader.saveBook(dirty[i]);
		},
		getNextRequest: function() {
			if (this.activeRequest || !NetworkErrorRetry.retryOk())
					return null;
			var request = null;
			if (this.photoQueue.length > 0) {
				var photo = this.photoQueue.pop();
				request = photo.getSaveDeferred();
			}
			if (request == null && this.bookQueue.length > 0) {
				var book = this.bookQueue.pop();
				request = book.getSaveDeferred();
				if (!request) // can happen if no diffs
					request = getNextRequest();
			}
			return request;
		},
		processQueue: function() {
			this.activeRequest = this.getNextRequest();
			if (!this.activeRequest)
				return;
			var THIS = this;
			this.activeRequest
				.done( function(response, msg, jqXHR) {
//					console.log("ajax done");
					NetworkErrorRetry.resetRetry();
				})
				.fail( function(jqXHR, textStatus, message) {
					// TODO handle missing book, server internal error
					console.log("xhr.fail Uploader");
					NetworkErrorRetry.retryLater();
					console.log("ajax fail");
				})
				.always( function() {
//					console.log('ajax always');
					THIS.activeRequest = null;
					THIS.processQueue();
				});
		}
	}


	// Save modified books every second.
	window.setInterval( Uploader.saveAll, SAVE_INTERVAL*1000);

	scope.Uploader = Uploader;
	scope.NetworkErrorRetry = NetworkErrorRetry;

	// Save before navigating away
	window.onbeforeunload = function(e) {
		NetworkErrorRetry.resetRetry();
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
				book.applyBroadcastPatch(message.id, message.payload);
				break;
			}
		},
		reconnect: function(book) {
			if (scope.NetworkErrorRetry.retryOk()) {
				DiffStream.connect(book);
			}
			else {
				window.setTimeout(function() {
					DiffStream.connect(book);
				}, PB.NetworkErrorRetry.whenToRetry + 10);
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
//					console.log("ServerStream opened " + stream.id);
				},
				message: function(ev) {
//					console.log("Server stream message " + stream.id)
					DiffStream.handleMessage(book, ev.data);
				},
				error: function(ev) {
					console.log("serverStream error , possible closure " + stream.id);
				},
				close: function(ev) {
					console.warn("server connection closed");
					scope.NetworkErrorRetry.retryLater();
					book.stream = null;
					DiffStream.reconnect(book);
				}
			});
			return stream;

		}
	}
	scope.DiffStream = DiffStream;
})(PB);

