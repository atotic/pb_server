// PageTemplate class

PB.PageTemplate = function(json) {
	var THIS = this;
	["id", "width", "height", 
		"position", "image_count", "text_count", "position_type",
		"html", "icon"]
		.forEach(function(x) { THIS[x] = json[x]});
}

// sort order: cover|flap|middle|back, same sorted by image_count
// middle sort order: photo|<rest alphabetically
PB.PageTemplate.sortFunction = function(a, b) {
	var positions = ["cover", "flap", "middle", "back"]
	var a_position = positions.indexOf(a.position);
	var b_position = positions.indexOf(b.position);
	if (a_position != b_position)
		return b_position - a_position;
	
	if (a.position_type == b.position_type)
		return a.image_count - b.image_count;
		
	if (a.position_type == "photo")
		return 1;
	if (b.position_type == "photo")
		return -1;
		
	var cmp = a.position_type.localeCompare(b.position_type);
	if (cmp == 0)
		return a.image_count - b.image_count;
	else
		return cmp;
}

PB.PageTemplate.prototype = {
	toIcon: function(options) {
		$.extend({
			desiredHeight: 128
		}, options);
		var div = $(this.icon);
		var height = parseInt(div.css("height"));
		var width = parseInt(div.css("width"));
		var scale = options.desiredHeight / height;
		div.css("width", Math.round(width * scale) + "px");
		div.css("height", Math.round(height * scale) + "px");
		return div;
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
	
	// This method is based upon ruby method PB::PageTemplate.make_page
	// These two methods have to be in sync
	// IF YOU EDIT THIS METHOD, MAKE SURE IT IS IN SYNC WITH RUBY
	makePage: function() {
		var dom = $("<div>" + this.html + "</div>");
		var idNodes = dom.find("*[id],.book-image,.actual-image,.book-text,.actual-text");
		// Assign unique id's to all elements
		var THIS = this;
		idNodes.each(function(index) {
			this.id = THIS.randomString(5) + (this.id || "");
		});
		var json = {
			'width': this.width,
			'height': this.height,
			'html': dom.html(),
			'icon': this.icon,
			'position': this.position,
			'id': null
		};
		return new PB.BookPage(json);
	}
}


// BookPage class


PB.BookPage = function(json) {
	for (var prop in json)	// make them all private
		this["_" + prop] = json[prop];
	this._dirty = {
		html: false,
		icon: false
	};
	this._deleted = false;
};

// Saves all dirty pages -- class method
PB.BookPage.saveAll = function() {
	var book = PB.book ? PB.book() : null;
	if (book)
		book.pages.forEach(function(page) { page.saveNow(); });
}

$.extend(PB.BookPage, new PB.EventBroadcaster("pageIconUpdated"));

PB.BookPage.prototype = {
	get id() {
		return this._id;
	},
	get dirty() {
		if (this._dirty.html || this._dirty.icon || this.id == null || this._deleted)
			console.log("Book page is dirty " + this._id);
		return this._dirty.html || this._dirty.icon || this._id == null || this._deleted;
	},
	get position() {
		return this._position;
	},
	browserHtml: function() {
		if (this._html)	{
			// This will need fixing if we use other prefixed properties
			var html =  this._html.replace(/-webkit-transform/g, $.browserCssPrefix + "transform");
			html = html.replace(/-webkit-border-image/g, $.browserCssPrefix + "border-image");
			return html;
		}
		else
			return null;
	},
	innerHtml: function (node) {
		// Book editing needs prefixed CSS styles (-webkit-transform)
		// Our pdf engine expects -webkit styles
		// When saving, all prefix styles are saved with -webkit- prefixes
	  // styleToWebkit does this.
		// function styleToUserAgent reverses this
		function styleToWebkit(val) {
			var styles = val.split(";");
			var stylesToRemove = {};
			for (var i=0; i<styles.length; i++) {
				var nameval = styles[i].split(":");
				if (nameval.length != 2) continue;
				nameval[0] = nameval[0].trim();
				nameval[1] = nameval[1].trim();
				var m = nameval[0].match(/(-moz-|-webkit-|-ms-|-o-)(.+)/);
				if (m) { // m[1] is '-webkit'; m[2] is 'transform'
					// mutate -moz-transform:rotate(45) into transform:rotate(45);-webkit-transform:rotate(45);
					// assigns two values to single style entry, -webkit- and non-prefix
					var s = "-webkit-" + m[2] + ":" + nameval[1] + ";" + m[2] + ":" + nameval[1];
					styles[i] = s;
					stylesToRemove[m[2]] = true;
				}
			}
			for (var i=0; i<styles.length; i++) {
				var nameval = styles[i].split(":");
				if (nameval[0] in stylesToRemove)
					styles.splice(i--, 1);
			}
			return styles.join(";");
		}
		
		function serializeAttribute(a) {
			var output = a.localName.toLowerCase() + '="';
			var value = a.value;
			if (a.localName.toLowerCase() == "style")
				value = styleToWebkit(value);
			output += value.replace(/"/g, "&quot;");
			output += '"';
			return output;
		}
	
		var singles = {
			area:true, base:true, basefont:true, bgsound:true, br:true, col:true, command:true,
			embed:true,frame:true,hr:true, img:true, input:true, keygen:true, link:true, meta:true,
			param:true, source:true, track:true, wbr:true
		}
	
		function serializeElement(dom) {
			var output = "<" + dom.nodeName.toLowerCase();
	
			for (var i=0; i<dom.attributes.length; i++) 
				output += " " + serializeAttribute(dom.attributes.item(i));
	
			output += ">";
			if (! (dom.nodeName.toLowerCase() in singles)) {
				for (var i=0; i < dom.childNodes.length; i++)
					output += serializeNode(dom.childNodes.item(i));
				output += "</" + dom.nodeName.toLowerCase() + ">";
			}
			return output;
		}
	
		function serializeText(dom) {
			return dom.textContent.replace(/</g, "&lt;").replace(/>/g, "&gt;");
		}
	
		function serializeNode(node) {
			switch (node.nodeType) {
				case 1: // ELEMENT_NODE
					return serializeElement(node);
				case 3:	// Text
				case 4: // CData
					return serializeText(node);
				default:
					console.log("Not serializing node type " + dom.nodeType);
			}
			return "";
		}
	
		var output = "";
		for (var i=0; i < node.childNodes.length; i++)
			output += serializeNode(node.childNodes.item(i));
		return output;
	 // http://www.whatwg.org/specs/web-apps/current-work/multipage/the-end.html#html-fragment-serialization-algorithm
},

	// Reads HTML from DOM
	// Fixes up the html in canonical form:
	// - remove display artifacts; fix style declaration; patch up img src, etc
	readHtml: function() {
		if (this._displayDom == null) {
			console.warn("_displayDom is null");
			this._html = null;
			return;
		}
		var dom = this._displayDom.cloneNode(true);
		// Our src might be local files, change to server location
		$(dom).find("img").each(function(index, el) {
			// TODO we might not know server location until file is saved.
			var src = el.getAttribute("src");
			var serverSrc = PB.book().getPhotoByFileUrl(src);
			if (serverSrc != null)
				el.setAttribute("src", serverSrc.getServerUrl('display'));
		});
		// Remove display artifacts
		$(dom).find(".deleteme").each(function(index, el) {
			$(el).remove();
		});
		// Remove drag'n'drop artifacts
		$(dom).find(".ui-droppable").each( function(index, el) {
				$(el).removeClass("ui-droppable");	
		});
		// Remove other artifactss
		$(dom).find("br[_moz_dirty]").removeAttr("_moz_dirty");
		$(dom).find("*[contenteditable]").removeAttr("contenteditable");
		this._html = this.innerHtml(dom);
	},

	// Sets dom element that is displaying the page
	setDisplayDom: function(domEl) {
		if (domEl && 'jquery' in domEl)
			domEl = domEl.get(0);
		if (domEl == null && this._displayDom && this._dirty.html)
			this.readHtml();
		this._displayDom = domEl;
	},
	// DOM must be set when modified
	setDomModified: function() {
		if (!this._displayDom)
			console.error("Page must be displayed when setDomModified");
		this._dirty.html = true;
	},
	// Returns DOM, and selects it in editor if necessary
	getDom: function() {
		if (this._displayDom == null)
			PB.UI.Pagetab.selectPage(this);
		if (this._displayDom == null) {
			console.error("Cannot get dom for BookPage");
			throw("No dom");
		}
		return this._displayDom;
	},

	// call before dom is disconnected
	saveNow: function() {
		if (this.dirty)
			PB.uploadQueue.upload(this);
	},
	
	//
	deleteOnServer: function() {
		this._deleted = true;
		if (this._id)
			PB.uploadQueue.upload(this);
	},

	// Call when a photo on a page has been changed
	// book_image_div contains the changed photo
	updateIcon: function(book_image_div) {
		// to update, need dom index, and img src
		book_image_div = $(book_image_div);
		var imageIndex = book_image_div.parents(".book-page").first()
			.find(".book-image")
			.toArray().indexOf(book_image_div.get(0));
		var img_tag = book_image_div.find(".actual-image");
		var img_src = img_tag.attr("src");
		if (img_src == undefined) {
			if (book_image_div.height() > book_image_div.width())
				img_src = "/assets/common/v1.jpg";
			else
				img_src = "/assets/common/h1.jpg";
		}
		// update the icon dom
		var icon_dom = $(this._icon);
		img_tag = icon_dom.find("img[data-img-pos="+imageIndex+"]");
		if (img_tag.length == 0) {
			console.error("updateIcon could not find matching image"); 
			return;
		}
		img_src = img_src.replace(/\?size=.*$/g, "");
		img_tag.attr("src", img_src + "?size=icon");
		
		// save changes
		this._icon = this.innerHtml($("<div/>").append(icon_dom).get(0));
		this._dirty.icon = true;
		PB.BookPage.send('pageIconUpdated', this);
	},
	createNewPageDeferred: function() {
		var html;
		var data = {
			'width': this._width,
			'height': this._height,
			'html': this._html,
			'icon': this._icon,
			'position': this._position,
			'book_id': PB.book().id,
			'page_number_in_book': PB.book().pages.indexOf(this)
		};
		var xhr = $.ajax("/book_page", {
			data: data,
			type: "POST"
		});
		var THIS = this;
		xhr.success(function(data, textStatus, jqXHR) {
			console.log("Book page saved successfully " + data.id);
			THIS._id = data.id;
		});
		return xhr;
	},
	createDeleteDeferred: function() {
		if (this._id == null)
			return null;
		var xhr = $.ajax("/book_page/" + this._id, {
			type: "DELETE"
		});
		xhr.success(function(data, textStatus, jqXHR) {
			console.log("Page deleted " + this._id);
		});
		return xhr;
	},
	createUploadDeferred: function() {
		if (this._id == null)
			return this.createNewPageDeferred();
		else if (this._deleted)
			return this.createDeleteDeferred();
		// Gather data to be saved
		var savedHtml = false;
		var savedIcon = false;
		var data = {};
		if (this._dirty.html) {
			if (this._displayDom)
				this.readHtml();
			savedHtml = this._html;
			data.html = savedHtml;
		}
		if (this._dirty.icon) {
			data.icon = this._icon;
			savedIcon = this._icon;
		} 
		
		var xhr = $.ajax("/book_page/" + this._id, {
			data: data,
			type: "PUT"
		});
		var THIS = this;
		
		// Clear out the dirty flags on completion
		// Take care not to clear them out if page was modified while saving
		xhr.done(function(response, msg, jqXHR) {
			if (jqXHR.status == 200) {
				if (savedHtml) {
					if (THIS._displayDom)
						THIS.readHtml();
					if (THIS._html == savedHtml || THIS._html == null)
						THIS._dirty.html = false;
					// else there were changes since the save, so we are still dirty
				}
				if (savedIcon) {
					if (savedIcon == THIS._icon)
						THIS._dirty.icon = false;
				}
			}
		});
		return xhr;
	},
	
	// icon is a small div with images/etc
	toIcon: function(options) {
		$.extend({
			desiredHeight: 128
		}, options);
		var div = $(this._icon);
		var height = parseInt(div.css("height"));
		var width = parseInt(div.css("width"));
		var scale = options.desiredHeight / height;
		div.css("width", Math.round(width * scale) + "px");
		div.css("height", Math.round(height * scale) + "px");
		return div;
	}
};
