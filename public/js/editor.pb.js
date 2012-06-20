/* editor.pb.js
PB stands for PhotoBook
Common code, used by mobile and desktop

window.PB // Generic utilities
window.PB.Book // Book access
window.PB.Photo // Photo objects
*/
"use strict";


(function(window) {
	var PB = {
		init: function() {
		},
		clone: function(obj) {
			return JSON.parse(JSON.stringify(obj));
		},
		// $.extend causes cryptic errors when src is a prototype
		extend: function(target, src) {
			for (var p in src)
				target[p] = src[p];
		}
	};

	if (! ('PB' in window)) window.PB = {};

	$.extend(window.PB, PB);

})(window);

// PB.Book
(function(scope) {

	var bookCache = [];

	var Book = function(serverJson) {
		this.originalServerData = serverJson;	// keep original data for diffs
		this.serverData = PB.clone(serverJson); // all data from server are here
		bookCache.push(this);

		// Extend json with helper functions
		for (var i in this.serverData.document.photos) {
			PB.extend(this.serverData.document.photos[i], PB.Photo.prototype);
			// Let photos know what their id is
			Object.defineProperty(this.serverData.document.photos[i], 'id',
				{ value: i });

		}
		for (var i in this.serverData.document.roughPages) {
			PB.extend(this.serverData.document.roughPages[i], PB.RoughPage.prototype);
			// Let pages know what their id is
			Object.defineProperty(this.serverData.document.roughPages[i], 'id',
				{ value: i });
			Object.defineProperty(this.serverData.document.roughPages[i], 'book',
				{ value: this });
		}
	}

	Book.prototype = {
		get id() {
			return this.serverData.id;
		},
		get photoList() {
			return this.serverData.document.photoList;
		},
		photo: function(id) {
			return this.serverData.document.photos[id];
		},
		get roughPageList() {
			return this.serverData.document.roughPageList;
		},
		page: function(id) {
			return this.serverData.document.roughPages[id];
		}
	}


	Book.get =  function(id) {
		if (id === undefined)
			return bookCache.length > 0 ? bookCache[0] : null;
		else {
			for (var i=0; i<bookCache.length; i++)
				if (bookCache[i].id === id)
					return bookCache[i];
		}
		console.warn("Book.get miss");
		return null;
	}

	scope.Book = Book;
})(window.PB);

// PB.Photo
(function(scope) {
	var Photo = function(props) {
		$.extend(this, props);
	}

	Photo.prototype = {
		getUrl: function(size) {
			if (size < 129)
				return ( 's' in this.url ? this.url.s : this.url.l + "?size=icon");
			else if (size < 1025)
				return ( 'm' in this.url ? this.url.m : this.url.l + "?size=display");
			else
				return this.url;
		}
	}

	scope.Photo = Photo;
})(window.PB);

// PB.RoughPage
(function(scope) {
	var RoughPage = function(props) {
		$.extend(this, props);
	}

	RoughPage.prototype = {
		coverRegex: /^cover|^cover-flap|^back-flap|^back/,
		isDraggable: function() {
			debugger;
			return this.id.match(RoughPage.coverRegex) == null;
		},
		type: function() {
			if ( this.id.match(RoughPage.coverRegex))
				return 'cover';
			else
				return 'pages';
		},
		pageClass: function() {
			if ( this.id.match(RoughPage.coverRegex))
				return this.id;
			else
				return 'page';
		},
		pageTitle: function() {
			switch(this.id) {
				case 'cover': return 'cover';
				case 'cover-flap': return 'flap';
				case 'back-flap': return 'flap';
				case 'back': return 'back';
				default:
					return this.book.roughPageList.indexOf(this.id) - 3;
			}
		}
	}

	scope.RoughPage = RoughPage;
})(window.PB);
