// pb.gui.rect.js

(function(scope) {
	var Rect = function(r) {
		this.top = this.left = this.width = this.height = 0;
		if (!('bottom' in r || 'height' in r))
			throw new Error("rect must have bottom or height");
		if (!('right' in r || 'width' in r))
			throw new Error("rect must have right or height");
		if ('top' in r)
			this.top = r.top;
		if ('left' in r)
			this.left = r.left;
		if ('width' in r)
			this.width = r.width;
		else
			this.width = r.right - this.left;
		if ('height' in r)
			this.height = r.height;
		else
			this.height = r.bottom - this.top;
		if (this.height < 0) {
			console.warn('this.height < 0');
			this.height = 0;
		}
		if (this.width < 0) {
			console.warn('this.width < 0');
			this.width = 0;
		}
	}

	Rect.prototype = {
		toString: function() {
			return "t:" + this.top + ' l:' + this.left + ' w:' + this.width + ' h:' + this.height;
		},
		get right() {
			return this.left + this.width;
		},
		set right(val) {
			this.width = val - this.left;
			if (this.width < 0)
				console.warn("width is < 0");
		},
		get bottom() {
			return this.top + this.height;
		},
		set bottom(val) {
			this.height = val - this.top;
			if (this.height < 0)
				console.warn("height < 0");
		},
		get x() {
			return this.left;
		},
		get y() {
			return this.top;
		},
		round: function() {
			return new Rect({
				top: Math.round(this.top),
				left: Math.round(this.left),
				width: Math.round(this.width),
				height: Math.round(this.height)
			});
		},
		inset: function(inset) { // inset is number, or [t r b l]
			if (typeof inset == 'number') {
				return new Rect({
					top: this.top + inset,
					left: this.left + inset,
					width: this.width - inset * 2,
					height: this.height - inset * 2
				});
			}
			else if ($.isArray(inset) && inset.length == 4) {// TRBL
				return new Rect({
					top: this.top + inset[0],
					left: this.left + inset[3],
					width: this.width - inset[1] - inset[3],
					height: this.height - inset[0] - inset[2]
				});
			}
			else
				console.error("illegal inset value " + inset);
		},
		union: function(rectOrArray) {
			var rArray = $.isArray(rectOrArray) ? rectOrArray :
				rectOrArray ? [rectOrArray] : [];
			rArray = rArray.concat(this);
			var retVal = new Rect();
			for (var i=0; i< rArray.length; i++) {
				retVal.top = Math.min(retVal.top, rArray[i].top);
				retVal.left = Math.min(retVal.left, rArray[i].left);
				retVal.bottom = Math.max(retVal.bottom, rArray[i].bottom);
				retVal.right = Math.max(retVal.right, rArray[i].right);
			}
			return retVal;
		},
		intersect: function(r) {
			return new Rect({
				top: Math.max(this.top, r.top),
				left: Math.max(this.left, r.left),
				bottom: Math.min(this.bottom, r.bottom),
				right:Math.min(this.right, r.right)
			});
		},
		// return: scale
		fitInside: function(enclosure) {
			var vscale = enclosure.height / this.height;
			var hscale = enclosure.width / this.width;
			return Math.min(vscale, hscale) ;
		},
		// return: scale
		fillInside: function(enclosure) {
			var vscale = enclosure.height / this.height;
			var hscale = enclosure.width / this.width;
			return Math.max(vscale, hscale);
		},
		scaleBy: function(scale, scaleOrigin) {
			var retVal = new Rect(this);
			retVal.width = retVal.width * scale;
			retVal.height = retVal.height * scale;
			if (scaleOrigin) {
				if (retVal.top)
					retVal.top *= scale;
				if (retVal.left)
					retVal.left *= scale;
			}
			return retVal;
		},
		// centers this inside enclosing rect.
		centerIn: function(enclosingRect, options) {
			var options = $.extend({}, {
				focalPoint: {x:50, y:50}, // Focal point is the center of new rect in % units
				forceInside: false
			}, options );
			var myFocal = {
				x: options.focalPoint.x / 100 * this.width,
				y: options.focalPoint.y / 100 * this.height
			};
			var myRect = new Rect( {
				left: enclosingRect.width / 2 - myFocal.x,
				top: enclosingRect.height / 2 - myFocal.y,
				width: this.width,
				height: this.height
			});
			if (options.forceInside) {
				myRect.top = Math.min(0, myRect.top);
				myRect.left = Math.min(0, myRect.left);
				myRect.top = Math.max(enclosingRect.height - this.height, myRect.top);
				myRect.left = Math.max(enclosingRect.width - this.width, myRect.left);
			}
			return myRect;
		},
		moveBy: function(x, y) {
			return new Rect({
				top: this.top + y,
				left: this.left + x,
				width: this.width,
				height: this.height
			});
		},
		forceInside: function(enclosure) {
			var scale = this.fitInside(enclosure);
			var retVal;
			if (scale < 1)
				retVal = this.scaleBy(scale);
			else
				retVal = new Rect(this);
			if (retVal.top < enclosure.top)
				retVal.top = enclosure.top;
			if (retVal.left < enclosure.left)
				retVal.left = enclosure.left;
			if (retVal.bottom > enclosure.bottom)
				retVal.top = enclosure.bottom - this.height;
			if (retVal.right > enclosure.right)
				retVal.left = enclosure.right - this.width;
			return retVal;
		}
	}
	scope.Rect = Rect;
})(GUI);
