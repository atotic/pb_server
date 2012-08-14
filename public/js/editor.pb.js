/* editor.pb.js
PB stands for PhotoBook
Common code, used by mobile and desktop

window.PB // Generic utilities
window.PB.Book // Book access
window.PB.Photo // Photo objects
*/

// PB, general utility routines
(function(window) {
"use strict";

	var changeListeners = {};

	var PB = {
		init: function() {
		},
		clone: function(obj) {
			return JSON.parse(JSON.stringify(obj));
		},
		// $.extend causes cryptic errors when src is a prototype
		extend: function(target, src) {
			for (var p in src) {
				Object.defineProperty(target, p,
					{ value: src[p] });
			}
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
				this.broadcastChange(batch[i].model, batch[i].propName, batch[i].options);
		},
		cancelChangeBatch: function() {
			delete this._changeBatch;
		},
		broadcastChange: function(model, propName, options) {
			if (this._changeBatch)
				this._changeBatch.push({model:model, propName:propName, options:options});
			else {
				$('*:data("model.id=' + model.id + '")').trigger(PB.MODEL_CHANGED, [model, propName, options]);
				if (model.id in changeListeners)
					for (var i=0; i<changeListeners[model.id].length; i++)
						changeListeners[model.id][i].handleChangeEvent(model, propName, options);
			}
		},
		bindChangeListener: function(id, listener) {
			if (id in changeListeners)
				changeListeners[id].push(listener);
			else
				changeListeners[id] = [listener];
		},
		unbindChangeListener: function(id, listener) {
			if (id in changeListeners) {
				var idx = changeListeners[id].indexOf(listener);
				if (idx != -1) {
					changeListeners[id].slice(idx, 1);
					if (changeListeners[id].length == 0)
						delete changeListeners[id];
				}
				else
					console.warn("could not unregister listener");
			}
		}
	};

	if (! ('PB' in window)) window.PB = {};

	$.extend(window.PB, PB);

})(window);

// PB.Book
// Book is generated
(function(scope) {
"use strict";

	var bookCache = [];

	var Book = function(serverJson) {
		this._dirty = false;
		this._locked = false;
		this._proxies = {};
		this.serverData = serverJson;	// keep original data for diffs
		this.localData = PB.clone(serverJson); // all data from server are here
		this._localId = PB.randomString(6);	// local id broadcast with patches
		bookCache.push(this);

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
			return this.serverData.last_diff;
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
		get title() {
			return this.localData.document.title || "Untitled";
		},
		get locked() {
			return this._locked;
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
		_getPageProxy: function(id) {
			if (id in this._proxies)
				return this._proxies[id];
			else
				if (id in this.localData.document.roughPages)
					this._proxies[id] = new PB.RoughPageProxy(id, this);
				else
					throw "No such page";
			return this._proxies[id];
		},
		page: function(id) {
			return this._getPageProxy(id);
		},
		_getPhotoProxy: function(id) {
			if (id in this._proxies)
				return this._proxies[id];
			else
				if (this.localData.document.photoList.indexOf(id) == -1)
					throw "No such photo";
				else
					this._proxies[id] = new PB.PhotoProxy(id, this);
			// Non-existent proxies
			return this._proxies[id];
		},
		photo: function(id) {
			return this._getPhotoProxy(id);
		},
		lockUp: function(reason) { // Called when book is corrupted.
			this._locked = reason;
			PB.broadcastChange(this, 'locked')
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
		_broadcastDiffChanges: function(changes) {
			function member(arry, index) {
				if (index < arry.length)
					return arry[index];
				else
					return null;
			}
			for (var i=0; i<changes.length; i++) {
				// all the changes to our structure. Need to deduce what has changed
				var options = {animate: true};

				var objectPath = changes[i][1].objectPath();
				var document_var= member(objectPath, 1);
				if (document_var == this.localData.document.roughPageList)
					PB.broadcastChange(this, 'roughPageList', options);
				else if (document_var == this.localData.document.roughPages) {
					var roughPage = member(objectPath, 2);
					var rough_page_var = member(objectPath, 3);
					if (rough_page_var == roughPage.photoList) {
						this._pagePhotosChanged(roughPage, options);
						PB.broadcastChange(roughPage, 'photoList', options);
					}
					else
						console.log(changes[i][0], changes[i][1].path());
				}
				else if (document_var == this.localData.document.photoList) {
					PB.broadcastChange(this, 'photoList', options);
				}
					console.log(changes[i][0], changes[i][1].path());
			}
		},
		_patchPhotoIdChange: function(photo, propName, options) {
			console.log("patching photo ids", photo.id, options.newId);
			PB.unbindChangeListener(photo.id, this);
			// Patch the proxy
			if (photo.id in this._proxies) {
				var proxy = this._proxies[photo.id];
				delete this._proxies[photo.id];
				proxy.id = options.newId;
				if (! (proxy.id in this._proxies)) // duplicate detection
					this._proxies[proxy.id] = proxy;
			}
			// Patch the photoList
			var currentIdx = this.localData.document.photoList.indexOf(photo.id);
			if (currentIdx == -1)
				throw "Photo not in photoList changing id";
			var newIdx = this.localData.document.photoList.indexOf(options.newId);
			if (newIdx == -1)
				this.localData.document.photoList[currentIdx] = options.newId;
			else {
				// if the photo was a duplicate, and in our list, just remove it
				this.localData.document.photoList.splice(currentIdx, 1);
				PB.broadcastChange(this, 'photoList', options);
			}
			// Patch all the rough pages
			var pages = this.roughPageList;
			for (var i=0; i< pages.length; i++) {
				try {
					this.page(pages[i]).patchPhotoIdChange(photo, options.newId);
				}
				catch(ex) {
					console.log(this.page(pages[i]));
					debugger;
				}
			}
		},
		handleChangeEvent: function(model, propName, options) {
			switch (propName) {
				case 'id':
					this._patchPhotoIdChange(model, propName, options);
				break;
				default:
				break;
			}
		},
		addLocalPhoto: function(localFile, options) {
			try { // Local file creation can fail
				var serverPhoto = PB.ServerPhotoCache.createFromLocalFile(localFile);
				this.localData.document.photoList.push(serverPhoto.id);
				this._dirty = true;
				PB.bindChangeListener(serverPhoto.id, this);
				PB.broadcastChange(this, 'photoList', options);
				return serverPhoto;
			}
			catch(e) {
				console.log("addLocalPhoto fail",e);
				return null;
			}
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
			delete this._proxies[photo.id];
			if (index == -1) {
				console.warn("removing nonexistent photo from the book", photo.id);
				return;
			}
			this.localData.document.photoList.splice(index, 1);
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
			// safeguard, do not save book with temporary photo ids
			// wait until all images have been saved
			for (var i=0; i<this.localData.document.photoList.length; i++) {
				var id = this.localData.document.photoList[i];
				if (typeof id == 'string' && id.match(/temp/)) {
					console.log("trying to save with temp ids", id);
					return null;
				}
			}
			var dataToSave = PB.clone(this.localData.document);
			var diff = JsonDiff.diff(this.serverData.document, dataToSave);
			if (diff.length == 0) {
				this._dirty = false;
				return null;
			}
			else {
				console.log("book diff");
				JsonDiff.prettyPrint(diff);
			}
			diff[0].localId = this._localId;

			var ajax = $.ajax('/books/' + this.id, {
				data: JSON.stringify(diff),
				type: "PATCH",
				contentType: 'application/json'
			});
			var THIS = this;
			ajax.done(function(response, msg, jqXHR) {
				THIS.applyBroadcastPatch(response.diff_id, diff);
			});
			ajax.fail(function(jqXHR, textStatus, message) {
				if (jqXHR.status == 404)
					THIS.lockUp("The book was deleted.");
			});
			return ajax;
		},

		// index: page position for insert. -1 means last
		insertRoughPage: function(index, options) {
			var page = PB.RoughPageProxy.template(this);
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
			delete this._proxies[page.id];
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
			if (this._locked) {
				console.warn("Ignored patch, book is locked");
				return;
			}
			if (patch_id <= this.last_diff) {
//				console.warn("Received patch we already have");
				return;
			}
			try {
				var isLocal = patch.length > 0 && 'localId' in patch[0] && this._localId == patch[0]['localId'];
				// patch of serverData, migrate differences to localData
				var local_changes = JsonDiff.diff(this.serverData.document, this.localData.document);
				var newOriginal = JsonDiff.patch(this.serverData.document, patch);
				this.serverData.document = newOriginal;
				this.serverData.last_diff = patch_id;
				if (!isLocal)	// if diff originates locally, localData already has the diff, skip this
				{
					var newLocal = JsonDiff.patch(this.serverData.document, local_changes);
					// need to: this.localData = newLocal
					// we can't, because assignment would not broadcast changes to gui
					// instead, mutate localData by creating new diff
					var newDiff = JsonDiff.diff(this.localData.document, newLocal);
					var localDocAndChanges = JsonDiff.patch(this.localData.document, newDiff, {record_changes: true});
					this.localData.document = localDocAndChanges[0];
					var changes = localDocAndChanges[1];
					this._broadcastDiffChanges(changes);
				}
			}
			catch(e) {
				this.lockUp("Remote book edits were incompatible with your local changes.");
				console.log(e.message, patch_id, patch);
				PB.cancelChangeBatch();
			}
		},
		jsonPatchChange: function(proxy, type) {
			console.log("JsonPatchChange", type);
		}
	}

	Object.defineProperty(Book, "default", {get: function() { return bookCache[0]}});

	Book.getDirty = function() {
		var retVal = [];
		for (var i=0; i < bookCache.length; i++)
			if (bookCache[i].dirty)
				retVal.push(bookCache[i]);
		return retVal;
	}

	scope.Book = Book;
})(window.PB);


// PB.PhotoProxy
(function(scope) {

	// See ReferenceAPI
	var PhotoProxy = function(id, book) {
		this.id = id;
		this.book = book;
	}

	PhotoProxy.SMALL = 128;
	PhotoProxy.MEDIUM = 1024;
	PhotoProxy.LARGE = 2000;

	PhotoProxy.prototype = {
		get p() {
			if (!('_serverPhoto' in this))
				this._serverPhoto = PB.ServerPhotoCache.get(this.id);
			return this._serverPhoto;
		},
		getUrl: function(size) {
			if (size <= PhotoProxy.SMALL)
				return this.p.iconUrl;
			else if (size <= PhotoProxy.MEDIUM)
				return this.p.displayUrl;
			else
				return this.p.originalUrl;
		},
		isDraggable: function() {
			return true;
		},
		get status() {
			return this.p.status;
		},
		get progress() {
			return this.p.progress;
		}
	}

	scope.PhotoProxy = PhotoProxy;
})(window.PB);

// PB.RoughPageProxy
(function(scope) {
	"use strict";

	var RoughPageProxy = function(id, book) {
		this.id = id;
		this.book = book;
	}

	var coverRegex = /^cover|^cover-flap|^back-flap|^back/;
	RoughPageProxy.prototype = {
		get p() {
			return this.book.localData.document.roughPages[this.id];
		},
		get photoList() {
			return this.book.localData.document.roughPages[this.id].photoList;
		},
		isDraggable: function() {
			return this.id.match(coverRegex) == null;
		},
		isDroppable: function(flavor) {
			switch(flavor) {
			case 'roughPage':
			case 'addRoughPage':
				return this.type() != 'cover';
			default:
				return true;
			}
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
			var p = this.p;
			for (var i=0; i<p.photoList.length; i++)
				list.push(this.book.photo(this.photoList[i]));
			return list;
		},
		addPhoto: function(photo, options) {
			if (photo == null)
				return;
			var p = this.p;
			p.photoList.push(photo.id);
			this.book._pagePhotosChanged(this, options);
			PB.broadcastChange(this, 'photoList', options);
		},
		removePhoto: function(photo, options) {
			var p = this.p;
			var index = p.photoList.indexOf(photo.id);
			if (index == -1) throw "no such photo";
			p.photoList.splice(index, 1);
			this.book._pagePhotosChanged(this, options);
			PB.broadcastChange(this, 'photoList', options);
		},
		remove: function(options) {
			this.book.deleteRoughPage(this, options);
		},
		patchPhotoIdChange: function(photo, newId) {
			var p = this.p;
			var idx = p.photoList.indexOf(photo.id);
			if (idx != -1)
				p.photoList[idx] = newId;
		}
	}
	RoughPageProxy.template = function(book) {
		return {
			id: book.generateId(),
			photoList: []
		};
	}

	scope.RoughPageProxy = RoughPageProxy;
})(window.PB);
