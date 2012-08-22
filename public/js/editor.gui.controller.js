// editor.gui.controller.js

// GUI.Controller
(function(scope) {

	var navbarHeight = 44; // @navbar-height in less
	// Image palette variables
	var baseImageHeight = 128; 	// @image-height
	var imagePadding = 8;			// @image-padding
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
			var possible = this.getPossiblePhotoContainerHeights(GUI.PhotoPalette.maxImageHeight);
			return { min: possible[0], max: possible[possible.length -1]}
		},
		viewMoreImages: function() {
			var sizes = this.getPossiblePhotoContainerHeights(GUI.PhotoPalette.maxImageHeight);
			var height = $('#photo-list-container').height();
			for (var i=0; i< sizes.length; i++) // find next larger size
				if (sizes[i] > height) {
					this.setContainerHeight(sizes[i], true);
					return;
				}
		},
		viewFewerImages: function() {
			var sizes = this.getPossiblePhotoContainerHeights(GUI.PhotoPalette.maxImageHeight);
			var height = $('#photo-list-container').height();
			for (var i=sizes.length -1; i >= 0; i--) // find previous smaller size
				if (sizes[i] < height) {
					this.setContainerHeight(sizes[i], true);
					return;
				}
		},
		viewBiggerImages: function() {
			var nextImgSize = Math.floor(GUI.PhotoPalette.maxImageHeight * imageHeightScaler);
			if (nextImgSize < 256) {
				GUI.PhotoPalette.maxImageHeight = nextImgSize;
				this.viewMoreImages();
			}
		},
		viewSmallerImages: function() {
			var nextSize = Math.floor(GUI.PhotoPalette.maxImageHeight / imageHeightScaler);
			if (nextSize > baseImageHeight / 2) {
				GUI.PhotoPalette.maxImageHeight = nextSize;
				this.viewFewerImages();
			}
		},
		viewAllPhotos: function() {
			GUI.PhotoPalette.photoFilter = 'all';
		},
		viewUnusedPhotos: function() {
			GUI.PhotoPalette.photoFilter = 'unused';
		}
	};

	scope.Controller = Controller;
})(window.GUI);
