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
			$.event.special[this.MODEL_CHANGED] = {noBubble: true};
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
			var filter = $('*:data("model")');
			var dataMapper = {};
			filter.each(function() {
				var id = $.data(this,'model').id;
				if (id in dataMapper)
					dataMapper[id].push(this);
				else
					dataMapper[id] = [this];
			});
			for (var i=0; i < batch.length; i++) {
				this.broadcastChange(batch[i].model, batch[i].propName, batch[i].options, dataMapper);
			}
		},
		cancelChangeBatch: function() {
			delete this._changeBatch;
		},
		broadcastChange: function(model, propName, options, dataMapper) {
			if (this._changeBatch)
				this._changeBatch.push({model:model, propName:propName, options:options});
			else {
				try {
					if (dataMapper) {
						if (model.id in dataMapper)
							for (var i=0; i<dataMapper[model.id].length; i++)
								$(dataMapper[model.id][i]).trigger(PB.MODEL_CHANGED, [model, propName, options]);
					}
					else {
						var filter = $('*:data("model")');
						filter.filter('*:data("model.id=' + model.id + '")').trigger(PB.MODEL_CHANGED, [model, propName, options]);
				}
				} catch(ex) {
					debugger;
				}
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
		if ('photos' in serverJson) {
			for (var i=0; i<serverJson.photos.length; i++)
				PB.ServerPhotoCache.createFromJson( serverJson.photos[i]);
			delete serverJson.photos;
		}
		this.serverData = PB.clone(serverJson);	// keep original data for diffs
		this.localData = PB.clone(serverJson); // all data from server are here
		this._localId = PB.randomString(6);	// local id broadcast with patches
		bookCache.push(this);
		this.connectStream();
	}

	Book.prototype = {
		get id() {
			return this.localData.id;
		},
		get dirty() {
			return this._dirty;
		},
		get photoList() {
			return this.localData.document.photoList.slice(0, this.localData.document.photoList.length);
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
			var unusedList = this.photoList;
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
				if (this.localData.document.photoList.indexOf(id) == -1) {
					debugger;
					throw "No such photo";
				}
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
		connectStream: function() {
			this.disconnectStream();
			this._stream = PB.DiffStream.connect(this)
		},
		disconnectStream: function() {
			if (!this._stream)
				return;
			this._stream.close();
		},
		reset: function() {	// destroys the book pages
			this.localData.document.roughPageList = ["cover", "cover-flap", "back-flap", "back","P1","P2","P3","P4"];
			this.localData.document.roughPages = {
				"cover": { "id": "cover", "photoList": [] },
				"cover-flap": { "id": "cover-flap", "photoList": [] },
				"back-flap": { "id": "back-flap", "photoList": [] },
				"back": {"id": "back", "photoList": [] },
				"P1": {"id": "P1", "photoList": [] },
				"P2": {"id": "P2", "photoList": [] },
				"P3": {"id": "P3", "photoList": [] },
				"P4": {"id": "P4", "photoList": [] }
			};
			PB.broadcastChange(this, 'roughPageList');
			PB.broadcastChange(this, 'photoList');
			for (var i=0; i<this.localData.document.roughPageList.length; i++)
				PB.broadcastChange(this.page(this.localData.document.roughPageList[i]), 'photoList');
			this._dirty = true;
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
		_patchPhotoIdChange: function(photo, propName, options) {
//			console.log("patching photo ids", photo.id, options.newId);
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
		// generates id unique to this book
		generateId: function() {
			var id = PB.randomString(6);
			if (this.localData.document.photoList.indexOf(id) != -1
				|| this.localData.document.roughPageList.indexOf(id) != -1)
				return this.generateId();
			return id;
		},
		_applySinglePatch: function(patch_id, patch) {
			if (patch_id <= this.last_diff) {
//				console.warn("Received patch we already have");
				return [];
			}
			var changes = [];
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
				changes = localDocAndChanges[1];
			}
			this.localData.last_diff = this.serverData.last_diff;
			return changes;
		},
		// converts model change to change suitable for broadcast
		// returns [{model: m, prop: p}*];
		modelToBroadcastChange: function(change) {
			function member(arry, index) {
				if (index < arry.length)
					return arry[index];
				else
					return null;
			}
			var objectPath = change[1].objectPath();
			var document_var= member(objectPath, 1);
			if (document_var == this.localData.document.roughPageList)
				return [{model:this, prop: 'roughPageList'}];
			else if (document_var == this.localData.document.roughPages) {
				if (objectPath.length > 3) {
					var roughPage = member(objectPath, 2);
					var rough_page_var = member(objectPath, 3);
					if (rough_page_var == roughPage.photoList) {
						return [
						{model: roughPage, prop: 'photoList'},
						{model: this, prop:'photoList'}
						]
					}
					else
						console.log(change[0], change[1].path());
				}
			}
			else if (document_var == this.localData.document.photoList)
				return [{model:this, prop: 'photoList'}];
			else
				console.log(change[0], change[1].path());
			return [];
		},
		applyBroadcastPatches: function(patchArray) {
			if (this._locked) {
				throw "Patch ignored, book is locked";
				console.warn("Ignored patch, book is locked");
				return;
			}
			var t = new PB.Timer("applyBroadcastPatches");
			var changes = [];
			var i;
			try {
				var broadcastChanges = [];
				var alreadySeen = {};
				for (i=0; i<patchArray.length; i++) {
					var modelChanges = this._applySinglePatch(patchArray[i].id, patchArray[i].payload);
					for (var j=0; j<modelChanges.length; j++) {
						var bChange = this.modelToBroadcastChange(modelChanges[j]);
						for (var k=0; k<bChange.length; k++) {
							var key =  bChange[k].model.id + "-" + bChange[k].prop;
							if (! (key in alreadySeen)) {
								broadcastChanges.push(bChange[k]);
								alreadySeen[key] = true;
							}
						}
					}
				}
//				t.print("patch");
				PB.startChangeBatch();
				var options = {animate: broadcastChanges.length < 10};
				for (i=0; i<broadcastChanges.length; i++)
					PB.broadcastChange(broadcastChanges[i].model, broadcastChanges[i].prop, options);
				PB.broadcastChangeBatch();
//				t.print("broadcast");
			}
			catch(e) {
				this.lockUp("Remote book edits were incompatible with your local changes.");
				console.log(e.message, patchArray[i]);
			}
		},
		applyBroadcastPatch: function(patch_id, patch) {
			this.applyBroadcastPatches([{id: patch_id, payload: patch}]);
		},
		getDiff: function() {
			var diff = JsonDiff.diff(this.serverData.document,this.localData.document);
			if (diff.length > 0)
				diff[0].localId = this._localId;
			return diff;
		},
		getSaveDeferred: function() {
			// safeguard, do not save book with temporary photo ids
			// wait until all images have been saved
			for (var i=0; i<this.localData.document.photoList.length; i++) {
				var id = this.localData.document.photoList[i];
				if (typeof id == 'string' && id.match(/temp/)) {
					// console.log("trying to save with temp ids", id);
					return null;
				}
			}
			var diff = this.getDiff();
			if (diff.length == 0) {
				this._dirty = false;
				return null;
			}

			var ajax = $.ajax('/books/' + this.id, {
				data: JSON.stringify(diff),
				type: "PATCH",
				contentType: 'application/json',
				headers: { 'Pookio-last-diff': this.last_diff}
			});
			var THIS = this;
			ajax.done(function(response, msg, jqXHR) {
				switch(jqXHR.status) {
					case 226: // we got a stream of commands we need to implement to catch up
						var commands = JSON.parse(jqXHR.responseText);
						THIS.applyBroadcastPatches(commands);
						break;
					case 200:
							THIS.applyBroadcastPatch(response.diff_id, diff);
						break;
					default:
						console.warn("unknown success code ", jqXHR.status);
				}
			});
			ajax.fail(function(jqXHR, textStatus, message) {
				switch(jqXHR.status) {
					case 404:
					case 410:
						THIS.lockUp("The book was deleted.");
						break;
					case 412:
						console.error("We did not send the right header, should never see this");
						debugger;
					default:
						console.error("Unexpected network error submitting patch", jqXHR.status);
						debugger;
				}
			});
			return ajax;
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
		addPhotoById: function(photoId, options) {
			this.localData.document.photoList.push(photoId);
			PB.bindChangeListener(photoId, this);
			PB.broadcastChange(this, 'photoList', options);
		},
		removePhoto: function(photo, options) {
			//
			photo.doNotSave = true;
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
		// index: page position for insert. -1 means last
		insertRoughPage: function(index, options) {
			if (index == undefined)
				index = -1;
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
			return this.page(page.id);
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
		},
		get jsDate() {
			return this.p.jsDate;
		},
		get display_name() {
			return this.p.display_name;
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
