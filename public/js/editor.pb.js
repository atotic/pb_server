/* editor.pb.js
PB stands for PhotoBook
Common code, used by mobile and desktop

window.PB // Generic utilities
window.PB.Book // Book access
window.PB.Photo // Photo objects
*/
"use strict";

// PB, general utility routines
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
		},
		randomString: function (len, charSet) {
			charSet = charSet || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
			var randomString = '';
			for (var i = 0; i < len; i++) {
					var randomPoz = Math.floor(Math.random() * charSet.length);
					randomString += charSet.substring(randomPoz,randomPoz+1);
			}
			return randomString;
		},
		MODEL_CHANGED: 'modelchanged',
		startChangeBatch: function() {
			this._changeBatch = [];
		},
		broadcastChangeBatch: function() {
			var batch = this._changeBatch;
			delete this._changeBatch;
			for (var i=0; i < batch.length; i++)
				broadcastChange(batch[i].model, batch[i].propName, batch[i].options);
		},
		cancelChangeBatch: function() {
			delete this._changeBatch;
		},
		broadcastChange: function(model, propName, options) {
			if (this._changeBatch)
				this._changeBatch.push({model:model, propName:propName, options:options});
			else
				$('*:data("model.id=' + model.id + '")').trigger(PB.MODEL_CHANGED, [model, propName, options]);
		}
	};

	if (! ('PB' in window)) window.PB = {};

	$.extend(window.PB, PB);

})(window);

// PB.Book
// Book is generated
(function(scope) {

	var bookCache = [];

	var Book = function(serverJson) {
		this._dirty = false;
		this.serverData = serverJson;	// keep original data for diffs
		this.localData = PB.clone(serverJson); // all data from server are here
		bookCache.push(this);

		this._extendLocalData();
		PB.DiffStream.connect(this);
	}

	Book.prototype = {
		get id() {
			return this.localData.id;
		},
		get dirty() {
			return this._dirty;
		},
		get photoList() {
			return this.localData.document.photoList;
		},
		get last_diff() {
			return this.localData.last_diff;
		},
		get stream() {
			return this._stream;
		},
		set stream(val) {
			this._stream = val;
		},
		get roughPageList() {
			return this.localData.document.roughPageList;
		},
		page: function(id) {
			return this.localData.document.roughPages[id];
		},
		get title() {
			return this.localData.document.title || "Untitled";
		},
		get unusedPhotoList() {
			var usedHash = this._collectUsedImages();
			var unusedList = [].concat(this.photoList);
			for (var i=0; i< unusedList.length; i++) {
				if (usedHash[unusedList[i]]) {
					unusedList.splice(i,1);
					i -= 1;
				}
			}
			return unusedList;
		},
		// returns hash of images that appear in pages
		_collectUsedImages: function() {
			var retVal = {};
			var pageList = this.roughPageList;
			for (var i=0; i<pageList.length; i++) {
				var page = this.page(pageList[i]);
				for (var j=0; j<page.photoList.length; j++)
					retVal[page.photoList[j]] = true;
			}
			return retVal;
		},
		_pagePhotosChanged: function(page, options) {
			this._dirty = true;
			PB.broadcastChange(this, 'photoList', options);
		},
		_extendLocalData: function() {
			// Extend json with helper functions
			for (var i in this.localData.document.photos) {
				if ('id' in this.localData.document.photos[i])
					continue;
				PB.extend(this.localData.document.photos[i], PB.Photo.prototype);
				// Let photos know what their id is
				Object.defineProperty(this.localData.document.photos[i], 'id',
					{ value: i });
			}
			for (var i in this.localData.document.roughPages) {
				if ('id' in this.localData.document.roughPages[i])
					continue;
				PB.extend(this.localData.document.roughPages[i], PB.RoughPage.prototype);
				// Let pages know what their id is
				Object.defineProperty(this.localData.document.roughPages[i], 'id',
					{ value: i });
				Object.defineProperty(this.localData.document.roughPages[i], 'book',
					{ value: this });
			}
		},
		photo: function(id) {
			return this.localData.document.photos[id];
		},
		removePhoto: function(photo, options) {
			// Remove photo from all the pages
			var pageList = this.roughPageList;
			for (var i=0; i<pageList.length; i++) {
				var page = this.page(pageList[i]);
				if (page.photoList.indexOf(photo.id) != -1)
					page.removePhoto(photo, options);
			}
			// Remove it from the book
			var index = this.localData.document.photoList.indexOf(photo.id);
			if (index == -1)
				throw "no such photo";
			this.localData.document.photoList.splice(index, 1);
			delete this.localData.document.roughPages[photo.id];
			this._dirty = true;
			PB.broadcastChange(this, 'photoList', options);
		},
		// generates id unique to this book
		generateId: function() {
			var id = PB.randomString(6);
			if (this.photoList.indexOf(id) != -1
				|| this.roughPageList.indexOf(id) != -1)
				return this.generateId();
			return id;
		},
		getSaveDeferred: function() {
			var dataToSave = PB.clone(this.localData.document);
			var diff = JsonDiff.diff(this.serverData.document, dataToSave);
			if (diff.length == 0) {
				this._dirty = false;
				return null;
			}
			else
				JsonDiff.prettyPrint(diff);

			var ajax = $.ajax('/books/' + this.id, {
				data: JSON.stringify(diff),
				type: "PATCH",
				contentType: 'application/json'
			});
			var THIS = this;
			ajax.done(function(response, msg, jqXHR) {
				THIS.serverData.document = dataToSave;	// book saved, our data are now server data
			});
			return ajax;
		},

		// index: page position for insert. -1 means last
		insertRoughPage: function(index, options) {
			var page = new PB.RoughPage({book: this});
			var roughPageList = this.roughPageList;
			if (roughPageList.indexOf(page.id) != -1)
				throw "page already in book";
			this.localData.document.roughPages[page.id] = page;
			if (index > roughPageList.length || index == -1)
				this.localData.document.roughPageList.push(page.id);
			else
				this.localData.document.roughPageList.splice(index, 0, page.id);
			this._dirty = true;
			PB.broadcastChange(this, 'roughPageList', options);
		},
		deleteRoughPage: function(page, options) {
			var index = this.roughPageList.indexOf(page.id);
			if (index == -1)
				throw "no such page";
			this.localData.document.roughPageList.splice(index, 1);
			this._pagePhotosChanged(page, options);
			this._dirty = true;
			PB.broadcastChange(this, 'roughPageList', options);
		},
		moveRoughPage: function(page, dest, options) {
			var src = this.roughPageList.indexOf(page.id);
			if (src == -1)
				throw "no such page";
			this.localData.document.roughPageList.splice(src, 1);
			if (dest == -1 || dest > this.roughPageList.length)
				this.localData.document.roughPageList.push(page.id);
			else
				this.localData.document.roughPageList.splice(dest, 0, page.id);
			this._dirty = true;
			PB.broadcastChange(this, 'roughPageList', options);
		},
		applyBroadcastPatch: function(patch_id, patch) {
			if (patchId <= this.last_diff) {
				console.warn("Received patch we already have");
				return;
			}
			try {
				PB.startChangeBatch();
				// patch of serverData, migrate differences to localData
				var local_changes = JsonDiff.diff(this.serverData.document, this.localData.document);
				var newOriginal = JsonDiff.patch(this.serverData.document, patch);
				this.serverData = newOriginal;
				this.last_diff = patch_id;
				var newLocal = JsonDiff.patch(this.serverData.document, local_changes);
				// need to: this.localData = newLocal
				// we can't, because assignment would not broadcast changes to gui
				// instead, mutate localData by creating new diff
				var newDiff = JsonDiff.diff(this.localData.document, newLocal);
				JsonDiff.patch(this.localData.document, newDiff);
				this._extendLocalData();
				PB.broadcastChangeBatch();
			}
			catch(e) {
				console.log(e.message, patch_id, patch);
				PB.GUI.error("Your document might be corrupted. An edit received from the network failed. This sometimes happens when multiple people are editing the book at the same time. Please reload");
				PB.cancelChangeBatch();
				debugger;
			}
		}
	}

	Book.getDirty = function() {
		var retVal = [];
		for (var i=0; i < bookCache.length; i++)
			if (bookCache[i].dirty)
				retVal.push(bookCache[i]);
		return retVal;
	}

	scope.Book = Book;
})(window.PB);

// PB.Photo
(function(scope) {
	var Photo = function(props) {
		$.extend(this, props);
	}
	Photo.SMALL = 128;
	Photo.MEDIUM = 1024;
	Photo.LARGE = 2000;
	Photo.prototype = {
		getUrl: function(size) {
			if (size <= Photo.SMALL)
				return ( 's' in this.url ? this.url.s : this.url.l + "?size=icon");
			else if (size <= Photo.MEDIUM)
				return ( 'm' in this.url ? this.url.m : this.url.l + "?size=display");
			else
				return this.url;
		},
		isDraggable: function() {
			return true;
		}
	}

	scope.Photo = Photo;
})(window.PB);

// PB.RoughPage
// Rough pages get serialized and saved
// Properties that should not be saved are defined as hidden
(function(scope) {
	var RoughPage = function(props) {
		var hiddenProps = { 'book': true, 'id' : true} // non-serializable properties
		this.photoList = [];
		for (var p in props) {
			var enumerable = ! p in hiddenProps;
			Object.defineProperty(this, p, { value: props[p], enumerable: enumerable });
		}
		if (this.id == null)
			Object.defineProperty(this, 'id', { value: this.book.generateId()});
	}

	var coverRegex = /^cover|^cover-flap|^back-flap|^back/;

	RoughPage.prototype = {
		isDraggable: function() {
			return this.id.match(coverRegex) == null;
		},
		type: function() {
			if ( this.id.match(coverRegex))
				return 'cover';
			else
				return 'pages';
		},
		// indexOf this page inside the book
		indexOf: function() {
			return this.book.roughPageList.indexOf(this.id);
		},
		pageClass: function() {
			if ( this.id.match(coverRegex))
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
		},
		photos: function() {
			var list = [];
			for (var i=0; i<this.photoList.length; i++)
				list.push(this.book.photo(this.photoList[i]));
			return list;
		},
		addPhoto: function(photo, options) {
			// options = { animate: false}
			this.photoList.push(photo.id);
			this.book._pagePhotosChanged(this, options);
			PB.broadcastChange(this, 'photoList', options);
		},
		removePhoto: function(photo, options) {
			var index = this.photoList.indexOf(photo.id);
			if (index == -1) throw "no such photo";
			this.photoList.splice(index, 1);
			this.book._pagePhotosChanged(this, options);
			PB.broadcastChange(this, 'photoList', options);
		},
		remove: function(options) {
			this.book.deleteRoughPage(this, options);
		}
	}

	scope.RoughPage = RoughPage;
})(window.PB);
