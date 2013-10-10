// editor.pb.book.js

/*
	Book => {
		_dirty:
		_localId: each browser session has a unique id, used to avoid duplicate patches
		_corrupted: no save, true if book is corrupted
		_proxies: {id => proxy } mapping. There are proxies for pages/photos
		_stream: stream to server
		serverData: book as stored on the server
 			id: book database id
 			last_diff: id of the last diff that was applied to this document
 			document:
 				pageList: [page_id*]
 				pages: {
 					page_id => Page object
 					}
 				photoList: [photo_local_id*]
 				photoMap: {
 					photo_local_id => server_id
 				}
		localData: serverData with local mods
			}
		}
*/
// PB.Book
(function(scope) {
"use strict";

	var bookCache = [];

	var Book = function(serverJson, options) {
		options = $.extend( {
			streaming: true
		}, options);
		this._dirty = false;
		this._corrupted = false;
		this._proxies = {};
		if ('photos' in serverJson) {
			for (var i=0; i<serverJson.photos.length; i++)
				PB.ServerPhotoCache.createFromJson( serverJson.photos[i]);
			delete serverJson.photos;
		}
		this.serverData = PB.clone(serverJson);	// keep original data for diffs
		this.localData = PB.clone(serverJson); // all data from server are here
		this._localId = PB.randomString(6);	// local id broadcast with patches
		PB.ModelMap.set(this);
		bookCache.push(this);
		if (options.streaming)
			this.connectStream();
	}

	Book.prototype = {
		get id() {
			return 'book' + this.localData.id; // because image ids can conflict
		},
		get db_id() {
			return this.localData.id;	//
		},
		get dirty() {
			return this._dirty;
		},
		makeDirty: function() {
			this._dirty = true;
		},
		photo: function(id) {
			return this._getPhotoProxy(id);
		},
		page: function(id) {
			return this._getPageProxy(id);
		},
		get photoList() {
			return this.localData.document.photoList.slice();
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
		get pageList() {
			return this.localData.document.pageList.slice();
		},
		get facingPages() {
			return new PB.Book.FacingPages(this);
		},
		get title() {
			return this.localData.document.title || "Untitled";
		},
		get corrupted() {
			return this._corrupted;
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
		get themeId() {
			return this.localData.document.themeId;
		},
		set themeId(val) {
			if (this.themeId != val) {
				this.localData.document.themeId = val;
				this._dirty = true;
				PB.broadcastChange(this, 'themeId');
			}
		},
		generateDesignId: function(page) {
			// temporary function, will be replaced by
			if (page.designId)
				return;
			else
				page.setDesign( PB.ThemeUtils.randomDesignId(this.themeId) );
		},
		getPageDimensions: function(kind) {
			if (this.localData.document.dimensions) {
				var d = this.localData.document.dimensions;
				switch(kind) {
					case 'page':
					case 'cover':
					case 'back':
						return d;
					case 'cover-flap':
					case 'back-flap':
						return { width: d.width / 3, height: d.height }
				}
			}
			else
				return null;
		},
		setDimensions: function(dimensions) {
			if (this.localData.document.dimensions
				&& dimensions
				&& this.localData.document.dimensions.width == dimensions.width
				&& this.localData.document.dimensions.height == dimensions.height)
				return;
			if (dimensions == null)
				this.localData.document.dimensions = null;
			else
				this.localData.document.dimensions = { width: dimensions.width, height: dimensions.height };
			// update page dimensions
			var THIS = this;
			this.pageList.forEach( function( pageId) {
				var page = THIS.page( pageId );
				page.dimensions = THIS.getPageDimensions( page.kind );
			});
			this._dirty = true;
			PB.broadcastChange( this, 'dimensions');
		},
		get dimensions() {
			return this.localData.document.dimensions || { width: undefined, height: undefined};
		},
		serverPhotoId: function(bookPhotoId) { // bookPhotoId => serverPhotoId
			return this.localData.document.photoMap[bookPhotoId];
		},
		bookPhotoId: function(serverPhotoId) {
			var photoMap = this.localData.document.photoMap;
			for ( var p in photoMap)
				if (photoMap[p] == serverPhotoId)
					return p;
			return null;
		},
		_getPageProxy: function(id) {
			if (id === undefined)
				return undefined;
			if (id in this._proxies)
				return this._proxies[id];
			else
				if (id in this.localData.document.pages)
					this._proxies[id] = new PB.Page.Proxy(id, this);
				else
					throw new Error("No such page");
			return this._proxies[id];
		},
		lastPage: function() {
			var lastPageId = this.localData.document.pageList[ this.localData.document.pageList.length - 1];
			return this.page( lastPageId );
		},
		pageResolver: function() {
			var THIS = this;
			return function(id) { return THIS._getPageProxy(id);}
		},
		_getPhotoProxy: function(id) {
			if (id in this._proxies)
				return this._proxies[id];
			else
				if (this.localData.document.photoList.indexOf(id) == -1) {
					// console.warn('missing photo id', id);
					if (PB.ServerPhotoCache.exists(id))
						return PB.ServerPhotoCache.get(id);
					else {
						debugger;
						throw new Error("No such photo");
					}
				}
				else
					this._proxies[id] = new PB.PhotoProxy(id, this);
			return this._proxies[id];
		},
		photoResolver: function() {
			var THIS = this;
			return function(id) { return THIS._getPhotoProxy(id);};
		},
		setCorrupted: function(reason) { // Called when book is corrupted.
			this._corrupted = reason;
			PB.broadcastChange(this, 'corrupted')
		},
		connectStream: function() {
			if (this.db_id == 0)
				return;
			this.disconnectStream();
			this._stream = PB.DiffStream.connect(this)
		},
		disconnectStream: function() {
			if (!this._stream)
				return;
			this._stream.close();
		},
		reset: function() {	// destroys the book pages
			this.localData.document.pageList = ["cover", "cover-flap", "back-flap", "back","P1","P2","P3","P4"];
			this.localData.document.pages = {
				"cover": { "id": "cover", "itemList": [], "items":{} },
				"cover-flap": { "id": "cover-flap", "itemList": [], "items":{} },
				"back-flap": { "id": "back-flap", "itemList": [], "items":{} },
				"back": {"id": "back", "itemList": [], "items":{} },
				"P1": {"id": "P1", "itemList": [], "items":{} },
				"P2": {"id": "P2", "itemList": [], "items":{} },
				"P3": {"id": "P3", "itemList": [], "items":{} },
				"P4": {"id": "P4", "itemList": [], "items":{} }
			};
			PB.broadcastChange(this, 'pageList');
			PB.broadcastChange(this, 'photoList');
			for (var i=0; i<this.localData.document.pageList.length; i++)
				PB.broadcastChange(this.page(this.localData.document.pageList[i]), 'itemList');
			this._dirty = true;
		},
		// returns hash of images that appear in pages
		_collectUsedImages: function() {
			var retVal = {};
			var pageList = this.pageList;
			for (var i=0; i < pageList.length; i++) {
				var page = this.page( pageList[i] );
				var assetIds = page.filterAssetIds('photo');
				for (var j=0; j < assetIds.length; j++)
					retVal[ page.getAsset( assetIds[j] ).photoId ]  = true;
			}
			return retVal;
		},
		_pagePhotosChanged: function(page, options) {
			this._dirty = true;
			PB.broadcastChange(this, 'photoList', options);
		},
		_pageChanged: function(page, options) {
			this._dirty = true;
		},
		_patchPhotoIdChange: function(oldServerId, newServerId) {
			console.log("patching photo ids", oldServerId, newServerId);
			// Patch photoMap
			var oldLocalId;
			var duplicatePhotoId = false;
			for (var p in this.localData.document.photoMap) {
				if (this.localData.document.photoMap[p] == oldServerId) {
					oldLocalId = p;
					this.localData.document.photoMap[p] = newServerId;
				}
				else if (this.localData.document.photoMap[p] == newServerId)
					duplicatePhotoId = p;
			}
			if (duplicatePhotoId) {
				// Replace photo in all pages with the duplicate
				var pageList = this.pageList;
				for (var i=0; i<pageList.length; i++) {
					this.page(pageList[i]).swapPhoto(oldLocalId, duplicatePhotoId);
				}
				// Remove photo from our photo list and map
				this.localData.document.photoList.splice(this.localData.document.photoList.indexOf(oldLocalId), 1);
				delete this.localData.document.photoMap[oldLocalId];
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
/*
			if (this.localData.document.photoList.indexOf(id) != -1
				|| this.localData.document.pageList.indexOf(id) != -1)
				return this.generateId();
*/			return id;
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
			var objectPath = change.target.objectPath();
			var document_var= member(objectPath, 1);
			if (document_var == this.localData.document.dimensions)
				return [ { model: this, prop: 'dimensions'} ];
			if (document_var == this.localData.document.pageList)
				return [{model:this, prop: 'pageList'}];
			else if (document_var == this.localData.document.pages) {
				if (objectPath.length > 3) {
					var page = member(objectPath, 2);
					var pageProxy = this.page( page.id );
					var page_var = member(objectPath, 3);
					if (page_var == page.assets) {
						return [
							{ model: pageProxy, prop: 'assetList'},
							{ model: this, prop: 'photoList'}
						]
					} else if (page_var == page.dimensions) {
						return [ { model: pageProxy, prop: 'dimensions' }];
					} else if (page_var == 'title') {
						return [ { model: pageProxy, prop: 'title'} ];
					}
					else
						console.log(change.op, change.target.path());
				}
			}
			else if (document_var == this.localData.document.photoList)
				return [{model:this, prop: 'photoList'}];
			else
				console.log(change.op, change.target.path());
			return [];
		},
		applyBroadcastPatches: function(patchArray) {
			if (this._corrupted) {
				console.warn("Ignored patch, book is corrupted");
				throw new Error("Patch ignored, book is corrupted");
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
							var key = bChange[k].model.id + "-" + bChange[k].prop;
							if (! (key in alreadySeen)) {
								broadcastChanges.push(bChange[k]);
								alreadySeen[key] = true;
							}
						}
					}
				}
//				t.print("patch");
				PB.startChangeBatch();
				var options = { animate: broadcastChanges.length < 10 };
				var THIS = this;
				broadcastChanges.forEach( function( change ) {
					if (change.prop == 'assetList')
						THIS.page( change.model.id ).registerAssetIdResolvers();
					PB.broadcastChange(change.model, change.prop, options );
				});
				PB.broadcastChangeBatch();
//				t.print("broadcast");
			}
			catch(e) {
				this.setCorrupted("Remote book edits were incompatible with your local changes.");
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
		// Preflight checks
			// console.log('getSaveDeferred');
			if (this._corrupted)
				return null;
			// safeguard, do not save book with temporary photo ids
			// wait until all images have been saved
			for (var p in this.localData.document.photoMap) {
				if (typeof p == 'string' && p.match(/temp/)) {
					// console.log("trying to save with temp ids", id);
					return null;
				}
			}
			var pageList = this.pageList;
			var canSave = true;
			// check if pages are in 'saveable' state
			for (var i=0; i<pageList.length; i++) {
				// if (!this.page(pageList[i]).canSave) console.log("cannot save ", pageList[i]);
				canSave = canSave && this.page(pageList[i]).canSave;
			}
			if (!canSave)
				return;
			// make sure all pages were 'reflown'
			for (var i=0; i<pageList.length; i++) {
				var page = this.page(pageList[i]);
				if (page.needReflow) {
					try {
						page.reflow();
					}
					catch(ex) {
						canSave = false;
					}
				}
			}
			if (!canSave)
				return;

		// compute diffs
			var diff = this.getDiff();
			if (diff.length === 0) {
				this._dirty = false;
				return null;
			}

		// create ajax
			var ajax = $.ajax('/books/' + this.db_id, {
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
						break;
				}
			});
			ajax.fail(function(jqXHR, textStatus, message) {
				switch(jqXHR.status) {
					case 401:
						// TODO implement alert box, please log in again
						console.error("Unauthorized, need to log in again");
						PB.broadcastChange(THIS, 'pleaseLoginError');
						break;
					case 404:
					case 410:
						THIS.setCorrupted("The book was deleted.");
						break;
					case 412:
						console.error("We did not send the right header, should never see this");
						debugger;
						break;
					default:
						console.error("Unexpected network error submitting patch", jqXHR.status);
						debugger;
						break;
				}
			});
			// console.log('getSaveDeferred success');
			return ajax;
		},
		addLocalPhoto: function(localFile, options) {
			try { // Local file creation can fail
				var serverPhoto = PB.ServerPhotoCache.createFromLocalFile(localFile);
				var localId = this.generateId();
				var THIS = this;
				serverPhoto.addIdChangeListener(function(oldId, newId) { THIS._patchPhotoIdChange(oldId, newId)});
				this.localData.document.photoList.push(localId);
				this.localData.document.photoMap[localId] = serverPhoto.id;
				this._dirty = true;
				PB.broadcastChange(this, 'photoList', options);
				return this.photo(localId);
			}
			catch(e) {
				console.log("addLocalPhoto fail",e);
				return null;
			}
		},
		addServerPhoto: function( serverPhotoId, options ) {
			var localId = this.generateId();
			this.localData.document.photoList.push(localId);
			this.localData.document.photoMap[localId] = serverPhotoId;
			this._dirty = true;
			PB.broadcastChange(this, 'photoList', options);
			return localId;
		},
		removePhoto: function(photo, options) {
			//
			photo.doNotSave = true;
			// Remove photo from all the pages
			var pageList = this.pageList;
			for (var i=0; i<pageList.length; i++) {
				var page = this.page(pageList[i]);
				var assetId;
				while (assetId = page.findAssetIdByPhotoId(photo.id))
					page.removeAsset(assetId);
			}
			// Remove it from the book
			var index = this.localData.document.photoList.indexOf(photo.id);
			delete this._proxies[photo.id];
			if (index == -1) {
				console.warn("removing nonexistent photo from the book", photo.id);
				return;
			}
			this.localData.document.photoList.splice(index, 1);
			delete this.localData.document.photoMap[photo.id];
			this._dirty = true;
			PB.broadcastChange(this, 'photoList', options);
		},
		addPageHelper: function (index) {
			var page = PB.Page.Proxy.blank(this);
			var pageList = this.pageList;
			if (pageList.indexOf(page.id) != -1)
				throw new Error("page already in book");
			this.localData.document.pages[page.id] = page;
			if (index > pageList.length || index == -1)
				this.localData.document.pageList.push(page.id);
			else
				this.localData.document.pageList.splice(index, 0, page.id);
			return page;
		},
		// index: page position for insert. -1 means last
		addPage: function(index, options) {
			if (index == undefined)
				index = -1;
			var page = this.addPageHelper(index); // always insert two pages, to keep numbers legal
			this.addPageHelper(-1);
			this._dirty = true;
			PB.broadcastChange(this, 'pageList', options);
			return this.page(page.id);
		},
		removePageHelper: function (page) {
			var index = this.pageList.indexOf(page.id);
			if (index == -1)
				throw new Error("no such page");
			if (index >= this.localData.document.pageList.length)
				throw new Error("no such page");
			this.localData.document.pageList.splice(index, 1);
			delete this._proxies[page.id];
		},
		removePage: function(page, options) {
			this.removePageHelper( page );
			// make number of pages legal again
			var lastPage = this.lastPage();
			// remove last page if empty
			if ( lastPage.isEmpty() )
				this.removePageHelper( lastPage );
			else // or add page to the end
				this.addPageHelper(-1);
			this._pagePhotosChanged(page, options);
			this._dirty = true;
			PB.broadcastChange(this, 'pageList', options);
		},
		movePage: function(page, dest, options) {
			var src = this.pageList.indexOf(page.id);
			if (src == -1)
				throw new Error("no such page");
			this.localData.document.pageList.splice(src, 1);
			if (dest == -1 || dest > this.pageList.length)
				this.localData.document.pageList.push(page.id);
			else
				this.localData.document.pageList.splice(dest, 0, page.id);
			this._dirty = true;
			PB.broadcastChange(this, 'pageList', options);
		}
	}

	Object.defineProperty(Book, "default", {get: function() { return bookCache[0]}});

	Book.FacingPages = function(book) {
		this.book = book;
		this._initFacing();
	};

	Book.FacingPages.prototype = {
		_initFacing: function() {
			this._facing = [];
			var pageList = this.book.pageList;
			var facing = [];
			var pagePair = [];
			function pairDone() {
				if (pagePair.length !== 0)
					facing.push(pagePair);
				pagePair = [];
			}
			var page;
			var back;
			var backPage;
			var backFlap;
			var cover;
			var coverFlap;
			var firstPage;
			while (page = this.book.page(pageList.shift())) {
				switch(page.kind) {
					case 'cover':
						cover = page;
						break;
					case 'cover-flap':
						coverFlap = page;
						break;
					case 'back-flap': // back-flap pairs with last page
						backFlap = page;
						break;
					case 'back': // back pairs with cover || back-flap
						back = page;
						break;
					case 'page':
						if (!firstPage)
							firstPage = page;
						else {
							if (pagePair.length == 1) {
								pagePair.push(page);
								pairDone();
							}
							else {
								pairDone();
								pagePair = [page];
							}
						}
						break;
					default:
						console.warn("unknown page kind", page.kind);
						break;
				}
			}
			// after while loop, last page is in pagePair
			// cover
			if (!cover)
				console.warn('book has no cover');
			else
				facing.splice(0, 0, [null, cover]);

			// coverFlap with firstPage
			if (coverFlap) {
				if (firstPage)
					facing.splice(1, 0, [coverFlap, firstPage]);
				else
					facing.splice(1,0, [coverFlap, null]);
			}
			else {
				if (firstPage)
					facing.splice(1, 0, [null, firstPage]);
			}
			// backFlap with lastPage
			if (backFlap) {
				if (pagePair.length == 1) {
					pagePair.push(backFlap);
					pairDone();
				}
				else {
					console.warn("missing last page");
					facing.push([null, backFlap]);
				}
			}
			// back
			if (!back)
				console.warn('book has no back');
			else
				facing.push([back, null]);
			this._facing = facing;
		},
		get: function(index) {
			var f = this._facing[index];
			return {
				left: f[0],
				right: f[1]
			}
		},
		find: function(page) {
			if (page === null)
				return undefined;
			for (var i=0; i<this._facing.length; i++) {
				if (this._facing[i].indexOf(page) != -1)
					return i;
			}
			return undefined;
		},
		before: function(page) {
			var idx = this.find(page);
			if (idx === undefined)
				return this._facing[0];
			return this.get([Math.max(idx - 1, 0)]);
		},
		after: function(page) {
			var idx = this.find(page);
			if (idx == undefined)
				return this._facing[this._facing.length -1];
			return this.get([Math.min(idx + 1, this._facing.length - 1)]);
		}
	}

	Book.getDirty = function() {
		var retVal = [];
		for (var i=0; i < bookCache.length; i++)
			if (bookCache[i].dirty)
				retVal.push(bookCache[i]);
		return retVal;
	}

	Book.blank = function() {
		return new Book({
			id: 0,
			last_diff: 0,
			document: {
				title: "Untitled",
				themeId: null,
				pageList: [],
				pages: {},
				photoList: [],
				photoMap: [],
			}
		});
	};

	scope.Book = Book;
})(window.PB);
