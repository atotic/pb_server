// editor.pb.page.js


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


// PB.PageProxy
(function(scope) {
	"use strict";

	var PageProxy = function(id, book) {
		this.id = id;
		this.book = book;
	}

	var coverRegex = /^cover|^cover-flap|^back-flap|^back/;
	PageProxy.prototype = {
		get p() {
			return this.book.localData.document.pages[this.id];
		},
		get photoList() {
			return this.book.localData.document.pages[this.id].photoList;
		},
		get layoutId() {
			return this.book.localData.document.pages[this.id].layoutId;
		},
		set layoutId(val) {
			if (val != this.book.localData.document.pages[this.id].layoutId) {
				this.book.localData.document.pages[this.id].layoutId = val;
				this.book._pageChanged(this);
				PB.broadcastChange(this, 'layoutId');
			}
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
			return this.book.pageList.indexOf(this.id);
		},
		get pageClass() {
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
					return this.book.pageList.indexOf(this.id) - 3;
			}
		},
		photos: function() {
			var list = [];
			var p = this.p;
			for (var i=0; i<p.photoList.length; i++)
				list.push(this.book.photo(this.photoList[i]));
			return list;
		},
		dom: function(resolution) {
			if (!this.layoutId)
				throw "no dom yet";
			return PB.Template.cached(this.layoutId).generateDom(this, resolution);
		},
		patchPhotoIdChange: function(photo, newId) {
			var p = this.p;
			var idx = p.photoList.indexOf(photo.id);
			if (idx != -1)
				p.photoList[idx] = newId;
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
		}
	}
	PageProxy.blank = function(book) {
		return {
			id: book.generateId(),
			photoList: []
		};
	}

	scope.PageProxy = PageProxy;
})(window.PB);
