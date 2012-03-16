
/* Page in a book
 * Main page element contains data:
 * page-id, dirty, and class "page"
 *
 * DOM structure:
 * #main-container
 *   div.page-enclosure data:page(model)
 * 		 div.book-page
 *       
 */
PB.UI.Bookpage = {

	attachImageManipulators: function(bookImage) {
		bookImage = $(bookImage);
		var events = {
			mouseenter: function(ev) {
				if (bookImage.find(".actual-image").length == 0 || bookImage.data("hide-manipulators"))
					return;	// nothing to show, no image
				else
					PB.Manipulators.createImageButtons(bookImage);
			},
			mouseleave: function(ev) {
				bookImage.find(".manipulator-button").remove();				
			}
		}
		bookImage.bind(events);
	},
	attachTextManipulators: function(bookText) {
		bookText = $(bookText);
		var events = {
			mouseenter: function(ev) {
				if (bookText.data("hide-manipulators"))
					return;
				PB.Manipulators.Text.createTextButtons(bookText);			
			},
			mouseleave: function(ev) {
				if (! bookText.data("show-manipulators"))
					bookText.find(".manipulator-button").remove();
			}
		}
		bookText.bind(events);
	},
	// Loads page from model
	createPageElement: function(page) {
		var el = $(page.browserHtml());
		el.addClass("book-page");
		var enclosingDiv = $("<div></div>")
			.addClass('page-enclosure')
			.css("position", "relative")
			.css("width", el.css('width'))
			.css("height", el.css('height'))
			.data('page', page);
		enclosingDiv.append(el);
		el.find(".book-image").each( function() {
		// this must come after we are inside the enclosing div
				PB.Manipulators.makeDroppableImage(this);
				PB.UI.Bookpage.attachImageManipulators(this);
			});
		el.find(".book-text").each( function() {
			PB.Manipulators.Text.makeEditable(this);
			PB.UI.Bookpage.attachTextManipulators(this);
		});
		page.setDisplayDom(enclosingDiv);
		return enclosingDiv;
	},
	setCurrentPage: function(page) {
		// save the old page if possible
		$("#main-container div.page-enclosure").each(function() {
			var page = $(this).data('page');
			page.setDisplayDom(null);
		});
		var dom = this.createPageElement(page);
		dom.appendTo($("#main-container").empty());
		PB.UI.MainContainer.fitContent();
	},
	pageReplaced: function(page) {
		var THIS = this;
		$("#main-container div.page-enclosure").each(function() {
			var current_page = $(this).data('page');
			if (current_page.id == page.id)
			{
				var dom = THIS.createPageElement(page);
				dom.appendTo($("#main-container").empty());
				PB.UI.MainContainer.fitContent();
			}
		});
	},
	// Placement string can have following keywords
	// fixed|flex start|center|end rotate
	// fixed|flex determines whether frame is resizeable
	// start|center|end determines positioning in respect to original frame if image is resized
	// rotate|norotate means that box can rotate
	parseImagePlacement: function(imgDiv) {
		var placement = {
			sizing: "fixed",	// flex|fixed
			align: "center",
			rotate: "false",
			align_top: 'center',
			align_left: 'center'
		}
		var attr = imgDiv.attr("data-placement");
		if (attr) {
			var props = attr.split(" ");
			for (var i=0; i<props.length; i++)
				switch(props[i].toLowerCase()) {
					case "flex": placement.sizing = "flex"; break;
					case "fixed": placement.sizing = "fixed"; break;
					case "rotate": placement.rotate = true; break;
					case "norotate": placement.rotate = false; break;
					case "align-top-center": placement.align_top = "center"; break;
					case "align-top-start": placement.align_top = "start"; break;
					case "align-top-end": placement.align_top = "end"; break;
					case "align-left-center": placement.align_left = "center"; break;
					case "align-left-start": placement.align_left = "start"; break;
					case "align-left-end": placement.align_left = "end"; break;
					default: console.warn("Unknown data-placement attribute:", props[i]);
				}
		}
		return placement;
	},
	imageLoaded: function(imgDiv) {
		imgDiv = $(imgDiv);
		var img = imgDiv.find(".actual-image");
		if (img.length != 0) {
			var placement = this.parseImagePlacement(imgDiv);
			// calculate image div width/height, taking rotation into account
			//   image div depends on rotation/flex
			var dWidth = imgDiv.width();
			var dHeight = imgDiv.height();
			var iWidth = img.prop("naturalWidth");
			var iHeight = img.prop("naturalHeight");
			var rotated = false;
		// Determine imageDiv width/height
			// Rotate if needed
			if (placement.rotate) {
				var divOrient = Math.round(dWidth / dHeight * 100) >= 100 ? 'h' : 'v';
				var imgOrient = Math.round(iWidth / iHeight * 100) >= 100 ? 'h' : 'v';
				if (divOrient != imgOrient) {
					var tmp = dWidth;
					dWidth = dHeight;
					dHeight = tmp;
					rotated = true;
					console.log('rotating dWidth:' + dWidth + " dHeight:" + dHeight);
				}
			}
			// Determine size of imageDiv and image.
			var imageHScale = dWidth / iWidth;
			var imageVScale = dHeight / iHeight;
			if (placement.sizing == 'flex') {
				// For flex sizing, image cannot be outside original bounds. imageDiv wraps around the image
				if (imageVScale < imageHScale ) {
					iWidth *= imageVScale;
					iHeight *= imageVScale;
					dHeight = iHeight;
					dWidth = iWidth;
//					console.log("flexing, vertical fill iWidth: " + iWidth + " iHeight:" + iHeight + " dHeight:" + dHeight);
				} else {
					iWidth *= imageHScale;
					iHeight *= imageHScale;
					dWidth = iWidth;
					dHeight = iHeight;
//					console.log("flexing, horizontal fill iWidth: " + iWidth + " iHeight:" + iHeight + " dHeight:" + dHeight);
				}
			} else {
				// Fixed sizing, smallest image dimension fills div completely
				if (imageVScale < imageHScale) {
					iWidth *= imageHScale;
					iHeight *= imageHScale;
//					console.log("fixed, horizontal iWidth: " + iWidth + " iHeight:" + iHeight);
				}
				else {
					iWidth *= imageVScale;
					iHeight *= imageVScale;
//					console.log("fixed, vertical iWidth: ",iWidth, " iHeight:", iHeight);
				}
			}
			// All sizes determined, now position imageDiv
			var dTop = parseInt(imgDiv.css("top"));
			var dLeft = parseInt(imgDiv.css("left"));
			
			switch(placement.align_left) {
				case "start": break;
				case "center": dLeft = dLeft + (imgDiv.width() / 2) - dWidth / 2;break;
				case "end": dLeft = dLeft + (imgDiv.width()) - dWidth; break;
			}
			switch(placement.align_top) {
				case "start": break;
				case "center": dTop = dTop + (imgDiv.height() / 2) - dHeight / 2; break;
				case "end": dTop = dTop + (imgDiv.height()) - dHeight; break;
			}
//			console.log("imageDiv top:",dTop, " left", dLeft);
			// Position image
			var iLeft = (dWidth - iWidth) / 2;
			var iTop = (dHeight - iHeight) / 2;
//			console.log("orig top:", imgDiv.css("top"), " left", imgDiv.css("left"), "width:", imgDiv.width(), "height", imgDiv.height());
//			console.log("imgDiv top:", dTop, " left", dLeft, "width:", dWidth, "height", dHeight);
//			console.log("img top:", iTop, " left", iLeft, "width:", iWidth, "height", iHeight);
			imgDiv.css({
				top: dTop + "px",
				left: dLeft + "px",
				width: dWidth + "px",
				height: dHeight + "px"
			});
			img.css({
				top: iTop + "px",
				left: iLeft + "px",
				width: iWidth + "px",
				height: iHeight + "px"
			});
		}
	}
}