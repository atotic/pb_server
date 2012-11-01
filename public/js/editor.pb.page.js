// editor.pb.page.js


// PB.PageProxy
(function(scope) {
	"use strict";

/*
Page data design
photo_id => PB.ServerPhoto. globally unique, sql server id
						fetch with PB.ServerPhotoCache.get(photo_id)
           	warning: can mutate while image is being saved
background_id => PB.Template.Background, background template.
						fetch with PB.Template.get
text_id => Points to an object in page: page.texts[text_id]. Page unique, not global

	Page json => {
		id:
		photoList: [photo_id*]
		layoutId:
		layoutData: {
			// layout dependent. suggested:
			object_id => {
				layout data
			}
		}
		background: background_id
		textList: [text_id*]
		texts: {
			id => {
				text:
				font:
				size:
		}
		photoLayout: {
			id => {
				top
				left
				width
				height
			}*
		}
	}
*/
	var PageProxy = function(id, book) {
		this.id = id;
		this.book = book;
		PB.ModelMap.setResolver(id, book.pageResolver());
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
		get layout() {
			var id = this.book.localData.document.pages[this.id].layoutId;
			if (id)
				return PB.Template.cached(id);
			else
				return null;
		},
		set layoutId(val) {
			if (val != this.book.localData.document.pages[this.id].layoutId) {
				this.book.localData.document.pages[this.id].layoutId = val;
				this.book._pageChanged(this);
				PB.broadcastChange(this, 'layoutId');
			}
		},
		getEditMenu: function(layoutItemId) {
			return this.layout.getEditMenu(this, layoutItemId);
		},
		isDraggable: function() {
			return this.id.match(coverRegex) === null;
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
				this.book.assignTemplate(this);
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
			if (photo === null)
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
