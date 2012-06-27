// editor.gui.controller.js

// GUI.Controller
(function(scope) {

	var navbarHeight = 41; // @navbar-height in less
	// Image palette variables
	var baseImageHeight = 128; 	// @image-height
	var imagePadding = 8;			// @image-padding
	var imageHeight = baseImageHeight;
	var imageHeightScaler = 1.1;
	var roughPageHeight = 128;

	var Controller = {

		// Grow photo-list-container
		setContainerHeight: function(height, animate) {
			var paletteHeight = navbarHeight + height;
			var newProps = [
				['#palette-tabs-container .tab-pane', 'max-height', height],
				['#pb-palette', 'height', paletteHeight],
				['#pb-work-area', 'padding-top', paletteHeight],
				['#work-area-tools', 'padding-top', paletteHeight]
			]
			newProps.forEach(function(arry) {
				if (animate) {
					var o = {};
					o[arry[1]] = arry[2];
					$(arry[0]).animate(o, 100);
				}
				else
					$(arry[0]).css(arry[1], arry[2]);
			});
		},
		setImageHeight: function(height) {
			var scale = height / imageHeight;
			$('#photo-list-container img').each(function() {
				var el = $(this);
				el.stop();
				var nh = el.height() * scale;
				var nw = el.width() * scale;
				el.css('height', nh);
				el.css('width', nw);
			});
			imageHeight = height;
			// find the smallest size that encloses images
		},
		renumberRoughPages: function() {
			$('#work-area-rough .rough-page').each(function(idx) {
				if (idx < 4)
					return;
				var pNum = idx - 3;
				$(this).children('p').text(idx - 3);
				if (pNum % 2 == 1)
					$(this).removeClass('left-rough').addClass('right-rough');
				else
					$(this).removeClass('right-rough').addClass('left-rough');
			});
		},
		revealByScrolling: function(el, container) {
			el = $(el).get(0);
			container = $(container).get(0);
			var elTop = el.offsetTop;
			var elBottom = elTop + el.offsetHeight;
			var containerTop = container.scrollTop;
			var containerBottom = containerTop + container.offsetHeight;
			if (elTop < containerTop)
				$(container).animate({ 'scrollTop' : elTop - 4});
			else if (elBottom > containerBottom)
				$(container).animate({'scrollTop' : elBottom - container.offsetHeight});
		},
		getPossiblePhotoContainerHeights: function(imageHeight) {
			$('#photo-list-container').stop();
			var max = Math.min($('body').height() - 200, $('#photo-list').height() + imagePadding + 12 + 8);
			var curr = 8 + imageHeight + imagePadding / 2;
			var all = [ curr ];
			while ((curr += imageHeight + imagePadding) < max)
				all.push( curr);
			return all;
		},
		getMinMaxPaletteHeight: function() {
			var possible = this.getPossiblePhotoContainerHeights(imageHeight);
			return { min: possible[0], max: possible[possible.length -1]}
		},
		viewMoreImages: function() {
			var sizes = this.getPossiblePhotoContainerHeights(imageHeight);
			var height = $('#photo-list-container').height();
			for (var i=0; i< sizes.length; i++) // find next larger size
				if (sizes[i] > height) {
					this.setContainerHeight(sizes[i], true);
					return;
				}
		},
		viewFewerImages: function() {
			var sizes = this.getPossiblePhotoContainerHeights(imageHeight);
			var height = $('#photo-list-container').height();
			for (var i=sizes.length -1; i >= 0; i--) // find previous smaller size
				if (sizes[i] < height) {
					this.setContainerHeight(sizes[i], true);
					return;
				}
		},
		viewBiggerImages: function() {
			var nextImgSize = Math.floor(imageHeight * imageHeightScaler);
			if (nextImgSize < 256) {
				this.setImageHeight(nextImgSize);
				this.viewMoreImages();
			}
		},
		viewSmallerImages: function() {
			var nextSize = Math.floor(imageHeight / imageHeightScaler);
			if (nextSize > baseImageHeight / 2) {
				this.setImageHeight(nextSize);
				this.viewFewerImages();
			}
		},
		addRoughPage: function(targetPage, direction) {
			direction = direction || 'after';
			targetPage = targetPage || $('#work-area-rough > .rough-page:last').get(0);
			var pos = 'right';
			var pageNumber = 0;
			if (targetPage && targetPage.className.match(/right/))
				pos = 'left';
			var newPage = $("<div class='rough-page " + pos +"-rough'><p>" + pageNumber + "</p></div>");
			newPage.css('height', 0);
			if (targetPage) {
				if (direction == 'before')
					$(targetPage).before(newPage);
				else
					$(targetPage).after(newPage);
			}
			else {
				$('#work-area-rough').append(newPage);
			}
			newPage.animate({height: roughPageHeight},function() {
				newPage.css('display', 'auto');
				Controller.revealByScrolling(newPage, $('#pb-work-area'));
			});

			// cleanup: make it look nice
			scope.RoughWorkArea.makeDraggable(newPage);
			this.renumberRoughPages();
		},
		removeRoughPage: function(roughPage) {
			$(roughPage).animate({width:0}, function() {
				$(roughPage).detach();
				Controller.renumberRoughPages();
			});
		},
		removeImage: function(image) {
			$(image).animate({width: 0}, function() {
				$(image).detach();
			});
		}
	};

	scope.Controller = Controller;
})(window.GUI);
