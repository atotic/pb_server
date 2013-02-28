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
		itemList: [local_id*]
		items: {
			local_id: {
				type: photo|widget|text
				resource_id:
				top:
				left:
				width:
				height:
				layout_data: {
				}
			}*
		}

// OLD
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
		dom: function(resolution) {
			if (!this.layoutId)
				this.book.assignTemplate(this);
			if (!this.layoutId)
				throw "no dom yet";
			return PB.Template.cached(this.layoutId).generateDom(this, {resolution: resolution});
		},
		guessItemType: function(item) {
			if (item instanceof PB.PhotoProxy)
				return 'photo';
			else if (item instanceof PB.ServerPhoto)
				return 'serverPhoto';
			else {
				console.warn("Unknown item type:", item);
				throw new Error("Unknown item type");
			}
		},
		get _itemList() {
			return this.book.localData.document.pages[this.id].itemList;
		},
		get _items() {
			return this.book.localData.document.pages[this.id].items;
		},
		addItem: function(item, options) {
			var newId = this.book.generateId();
			var itemType = this.guessItemType(item);
			this._itemList.push(newId);
			Object.defineProperty(this._items, newId, {
				value: {
					type: itemType,
					resource_id: item.id,
					id: newId
				},
				enumerable: true,
				writable: true,
				configurable: true
			});
			if (itemType == 'photo')
				this.book._pagePhotosChanged(this, options);
			PB.broadcastChange(this, 'itemList', options);
		},
		removeItem: function(removeItem, options) {
			var itemList = this._itemList;
			var items = this._items;
			for (var i=0; i<itemList.length; i++)
				if (items[itemList[i]].resource_id == removeItem.id) {
					var isPhoto = items[itemList[i]].type == 'photo';
					delete items[itemList[i]];
					itemList.splice(i, 1);
					PB.broadcastChange(this, 'itemList', options);
					if (isPhoto)
						this.book._pagePhotosChanged(this, options);
					return;
				}
			throw new Error("no such item");
		},
		allItems: function() {
			var items = this._items;
			return this._itemList.map(function(item_id) {
				return items[item_id];
			});
		},
		itemsByType: function(type) {
			var itemList = this._itemList;
			var items = this._items;
			var THIS = this;
			return itemList
				.filter(function(item_id) {
					return items[item_id].type == type;
				})
				.map(function(item_id) {
					return items[item_id];
				});
		},
		item: function(id) {
			return this._items[id]
		},
		addPhoto: function(photo, options) {
			if (photo === null)
				return;
			this.addItem(photo, options);
		},
		removePhoto: function(photo, options) {
			this.removeItem(photo, options);
		},
		swapPhoto: function(oldId, newId) {
			var itemList = this._itemList;
			var idx = itemList.indexOf(oldId);
			if (idx == -1)
				return;
			var items = this._items;
			itemList[idx] = newId;
			items[newId] = items[oldId];
			delete items[oldId];
		},
		get photoList() {
			debugger;
			return this.book.localData.document.pages[this.id].photoList;
		},
		photos: function() {
			var THIS = this;
			return this.itemsByType('photo').map(function(item) {
				return THIS.book.photo(item.resource_id);
			});
		},
		remove: function(options) {
			this.book.deleteRoughPage(this, options);
		}
	}
	PageProxy.blank = function(book) {
		return {
			id: book.generateId(),
			itemList: [],
			items: {}
		};
	}

	scope.PageProxy = PageProxy;
})(window.PB);
