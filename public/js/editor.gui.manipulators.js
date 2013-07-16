// editor.gui.manipulators.js

(function(scope) {

"use strict";

var Manipulator = {

	// dom location in page coordinates
	// theta is dom rotation angle
	getBoundingCorners: function($dom, theta) {
		theta = theta || 0;
		theta = theta % 360;

		var ratio = $dom.height() / $dom.width();
		var bBox = $dom.get(0).getBoundingClientRect();
		var width = bBox.right - bBox.left;
		var height = bBox.bottom - bBox.top;

		if ((theta > 90 && theta < 180) || theta > 270)
			ratio = 1 / ratio;
		var tanTheta = Math.tan((theta % 90) * Math.PI / 180);
		var h1 = tanTheta == 0 ? 0 : height / ( 1 + ratio/tanTheta);
		var h2 = height - h1;
		var w1 = width / ( 1 + ratio * tanTheta);
		var w2 = width - w1;

		var top = 		{ x: bBox.left + w2, 	y: bBox.top};
		var right = 	{ x: bBox.right,	 	y: bBox.top + h1 };
		var bottom = 	{ x: bBox.left + w1, 	y: bBox.bottom };
		var left = 		{ x: bBox.left,			y: bBox.top + h2 };

		[left,top,bottom,right].forEach(function(el) {
			el.x += window.pageXOffset;
			el.y += window.pageYOffset;
		});
		if (theta <= 90)
			return { a: top, b: right, c: bottom, d: left };
		else if (theta <= 180)
			return { a: right, b: bottom, c: left, d: top};
		else if (theta <= 270)
			return { a: bottom, b: left, c: top, d: right};
		else
			return { a: left, b: top, c: right, d: bottom};
	},
	makeTextHandle: function(text) {
		return $('<div>')
			.addClass('manipulator-btn')
			.text(text);
	},
	makeIconHandle: function(iconName) {
		return $('<div>')
			.addClass('manipulator-btn')
			.append( $.parseHTML("<i class='icon-" + iconName + "'></i>") );
	},
	scaleFromCorners: function(corners, pageAsset) {
		var width = Math.sqrt(
			Math.pow(corners.b.y - corners.a.y, 2) +
			Math.pow(corners.b.x - corners.a.x, 2));
		return pageAsset.asset.css.width / width;
	}
}

var DefaultManipulator = function($pageDom, assetId) {
	this.pageDom = $pageDom;
	this.assetId = assetId;
}

DefaultManipulator.prototype = {
	reposition: function(pageDom) {
		this.pageDom = pageDom || this.pageDom;	// pageDom can get switched on resize
		var $itemDom = this.pageDom.find('*:data("model_id=' + this.assetId + '")');
		var pageAsset = PB.ModelMap.model(this.assetId);
		var corners = Manipulator.getBoundingCorners($itemDom, pageAsset.asset.rotate);
		this.handles.a.css({ top: corners.a.y, left: corners.a.x });
		this.handles.b.css({ top: corners.b.y, left: corners.b.x });
		this.handles.c.css({ top: corners.c.y, left: corners.c.x });
		this.handles.d.css({ top: corners.d.y, left: corners.d.x });
		this.scale = Manipulator.scaleFromCorners( corners, pageAsset );
	},
	show: function() {
		this.handles = {
			a: Manipulator.makeTextHandle('A'),
			b: Manipulator.makeTextHandle('B'),
			c: Manipulator.makeTextHandle('C'),
			d: Manipulator.makeTextHandle('D')
		};
		$(document.body)
			.append(this.handles.a)
			.append(this.handles.b)
			.append(this.handles.c)
			.append(this.handles.d);
		this.reposition();
	},
	remove: function() {
		$(this.handles.a).add(this.handles.b).add(this.handles.c).add(this.handles.d).remove();
	}
}

var MoveManipulator = function($pageDom, assetId) {
	this.pageDom = $pageDom;
	this.assetId = assetId;
}
MoveManipulator.prototype = {
	reposition: function(pageDom) {
		this.pageDom = pageDom || this.pageDom;
		var $itemDom = this.pageDom.find('*:data("model_id=' + this.assetId + '")');
		var pageAsset = PB.ModelMap.model(this.assetId);
		var corners = Manipulator.getBoundingCorners($itemDom, pageAsset.asset.rotate);
		this.handle.css({
			top: (corners.c.y + corners.a.y) / 2,
			left: (corners.c.x + corners.a.x) / 2
		});
		this.scale = Manipulator.scaleFromCorners(corners, pageAsset);
	},
	show: function() {
		this.handle = Manipulator.makeIconHandle('move');
		$(document.body).append(this.handle);
		var THIS = this;
		this.handle.hammer()
			.on('dragstart', {}, function(ev) { THIS.dragstart(ev) })
			.on('drag', {}, function(ev) { THIS.drag(ev) });
		this.reposition();
	},
	remove: function() {
		this.handle.remove();
	},
	dragstart: function(ev) {
		this.pageAsset = PB.ModelMap.model(this.assetId);
		this.startPos = { top: this.pageAsset.asset.css.top, left: this.pageAsset.asset.css.left };
	},
	drag: function(ev) {
		var top = this.startPos.top + ev.gesture.deltaY * this.scale;
		var left = this.startPos.left + ev.gesture.deltaX * this.scale;
		// constrain
		top = Math.max( -this.pageAsset.asset.css.height / 2, top);
		left = Math.max( -this.pageAsset.asset.css.width / 2, left);
		var pageDim = this.pageAsset.page.dimensions;
		top = Math.min( pageDim.height - this.pageAsset.asset.css.height / 2, top);
		left = Math.min( pageDim.width - this.pageAsset.asset.css.width / 2, left);
		this.pageAsset.page.updateAsset( this.assetId, { css: {
			top: top,
			left: left
		}});
		ev.gesture.srcEvent.preventDefault();
	}
};

var PanManipulator = function($pageDom, assetId) {
	this.pageDom = $pageDom;
	this.assetId = assetId;
};

PanManipulator.prototype = {
	reposition: function(pageDom) {
		this.pageDom = pageDom || this.pageDom;
		var $itemDom = this.pageDom.find('*:data("model_id=' + this.assetId + '")');
		var pageAsset = PB.ModelMap.model(this.assetId);
		var corners = Manipulator.getBoundingCorners($itemDom, pageAsset.asset.rotate);
		this.handle.css({
			top: (corners.c.y + corners.a.y) / 2 + this.manipulatorOffset.y,
			left: (corners.c.x + corners.a.x) / 2 + this.manipulatorOffset.x
		});
		this.scale = Manipulator.scaleFromCorners(corners, pageAsset);
		this.rotateRad= (pageAsset.asset.rotate || 0) * Math.PI / 180;
	},
	show: function() {
		this.handle = Manipulator.makeIconHandle('hand-up');
		$(document.body).append(this.handle);
		var THIS = this;
		this.handle.hammer()
			.on('dragstart', {}, function(ev) { THIS.dragstart(ev) })
			.on('drag', {}, function(ev) { THIS.drag(ev) })
			.on('dragend', {}, function(ev) { THIS.dragend(ev) });
		this.manipulatorOffset = { x:0, y:0};
		this.reposition();
		this.handle.css('transform', 'rotate(' + this.rotateRad+'rad)');
	},
	remove: function() {
		this.handle.remove();
	},
	dragstart: function(ev) {
		// TODO normalize focalPoint
		this.manipulatorOffset = { x:0, y:0};
		this.pageAsset = PB.ModelMap.model(this.assetId);
		this.focalPoint = $.extend( { x:50, y:50}, this.pageAsset.asset.focalPoint );
		this.focalScale = {
			x: this.pageAsset.asset.photoRect.width / 100,
			y: this.pageAsset.asset.photoRect.height / 100 };
		PB.stopEvent( ev.gesture.srcEvent );
		// ev.gesture.srcEvent.stopPropagation();
		// ev.gesture.srcEvent.preventDefault();
	},
	dragend: function(ev) {
		this.manipulatorOffset = { x:0, y:0 };
		this.reposition();
		ev.gesture.srcEvent.stopPropagation();
		ev.gesture.srcEvent.preventDefault();
	},
	drag: function(ev) {
		var deltaXRot = ev.gesture.deltaX * Math.cos(this.rotateRad) + ev.gesture.deltaY * Math.sin(this.rotateRad);
		var deltaYRot = -ev.gesture.deltaX * Math.sin(this.rotateRad) + ev.gesture.deltaY * Math.cos(this.rotateRad);
		var focalX = this.focalPoint.x - deltaXRot * this.scale / this.focalScale.x;
		var	focalY = this.focalPoint.y - deltaYRot * this.scale / this.focalScale.y;
		var range = this.pageAsset.page.getFocalPointRange( this.assetId );
		focalX = GUI.Util.clamp( focalX, range.x.min, range.x.max);
		focalY = GUI.Util.clamp( focalY, range.y.min, range.y.max);

		var manipulatorRotLoc = {
			x: -( focalX - this.focalPoint.x ) * this.focalScale.x / this.scale,
			y: -(focalY - this.focalPoint.y ) * this.focalScale.y / this.scale
		};

		this.manipulatorOffset.x = manipulatorRotLoc.x * Math.cos(-this.rotateRad) + manipulatorRotLoc.y * Math.sin(-this.rotateRad);
		this.manipulatorOffset.y = -manipulatorRotLoc.x * Math.sin(-this.rotateRad) + manipulatorRotLoc.y * Math.cos(-this.rotateRad);

		var focalPoint = { x: focalX, y: focalY };
		this.pageAsset.page.updateAsset( this.assetId, {focalPoint: focalPoint } );
		ev.gesture.srcEvent.stopPropagation();
		ev.gesture.srcEvent.preventDefault();
	}
};

var ZoomManipulator = function($pageDom, assetId) {
	this.pageDom = $pageDom;
	this.assetId = assetId;
};

ZoomManipulator.prototype = {
	reposition: function(pageDom) {
		this.pageDom = pageDom || this.pageDom;
		var $itemDom = this.pageDom.find('*:data("model_id=' + this.assetId + '")');
		var pageAsset = PB.ModelMap.model(this.assetId);
		var corners = Manipulator.getBoundingCorners($itemDom, pageAsset.asset.rotate);
		var distance = 100;
		var midpoint = {
			top: ( corners.c.y + corners.a.y ) / 2,
			left: ( corners.c.x + corners.a.x ) / 2
		};
		this.handles.zoom.css( midpoint );
		this.handles.left.css( {
			top: midpoint.top,
			left: midpoint.left - distance - this.manipulatorOffset
		});
		this.handles.right.css( {
			top: midpoint.top,
			left: midpoint.left + distance + this.manipulatorOffset
		});
		this.scale = Manipulator.scaleFromCorners( corners, pageAsset );
	},
	show: function() {
		this.pageAsset = PB.ModelMap.model( this.assetId );
		this.handles = {
			zoom: Manipulator.makeIconHandle('search').addClass('label'),
			left: Manipulator.makeIconHandle('resize-horizontal'),
			right: Manipulator.makeIconHandle('resize-horizontal')
		};
		for (var p in this.handles)
			$(document.body).append(this.handles[p]);
		var THIS = this;
		this.handles.left.hammer()
			.on('dragstart', {}, function(ev) { THIS.dragstart(ev, 'left') })
			.on('drag', {}, function(ev) { THIS.drag(ev, 'left') })
			.on('dragend', {}, function(ev) { THIS.dragend(ev, 'left') })
			.on('pinch', {}, function(ev) { THIS.pinch(ev, 'right') });
		this.handles.right.hammer()
			.on('dragstart', {}, function(ev) { THIS.dragstart(ev, 'right') })
			.on('drag', {}, function(ev) { THIS.drag(ev, 'right') })
			.on('dragend', {}, function(ev) { THIS.dragend(ev, 'right') })
			.on('pinch', {}, function(ev) { THIS.pinch(ev, 'right') });
		this.manipulatorOffset = 0;
		this.reposition();
	},
	remove: function() {
		for (var p in this.handles)
			this.handles[p].remove();
	},
	dragstart: function(ev) {
		this.manipulatorOffset = 0;
		this.zoom = this.pageAsset.asset.zoom || 1;
		this.zoomPerPixel = this.zoom / this.pageAsset.asset.photoRect.width * 2;
		PB.stopEvent( ev.gesture.srcEvent );
	},
	dragend: function(ev) {
		this.manipulatorOffset = 0;
		PB.stopEvent( ev.gesture );
		this.reposition();
	},
	drag: function(ev, side) {
		var direction = side == 'right' ? 1 : -1;
		var deltaX = direction * ev.gesture.deltaX;
		var newZoom = this.zoom + deltaX * this.zoomPerPixel;
		newZoom = Math.max(1, newZoom);
		this.manipulatorOffset = ( newZoom - this.zoom ) / this.zoomPerPixel;
		this.pageAsset.page.updateAsset( this.assetId, {zoom: newZoom } );
		PB.stopEvent( ev.gesture.srcEvent );
	},
	pinch: function(ev) {
		// TODO pinch is problematic
		// I want pinch on entire $itemDom
		// need to detect pinchstart, pinchend, conflicts with existing $itemDom 'touch' handler
		// need to temporarily disable that handler
		this.zoom = this.pageAsset.asset.zoom || 1;
		this.zoomPerPixel = this.zoom / this.pageAsset.asset.photoRect.width * 2;
		var newZoom = this.zoom * ev.gesture.scale;
		newZoom = Math.min( Math.max(1, newZoom), 10 );
		console.log("pinch", newZoom);
		this.manipulatorOffset = ( newZoom - this.zoom ) / this.zoomPerPixel;
		this.pageAsset.page.updateAsset( this.assetId, {zoom: newZoom } );
		PB.stopEvent(ev.gesture);
	}
};

var RotateManipulator = function($pageDom, assetId) {
	this.pageDom = $pageDom;
	this.assetId = assetId;
};

RotateManipulator.prototype = {
	reposition: function(pageDom) {
		this.pageDom = pageDom || this.pageDom;
		var $itemDom = this.pageDom.find('*:data("model_id=' + this.assetId + '")');
		var pageAsset = PB.ModelMap.model(this.assetId);
		var corners = Manipulator.getBoundingCorners($itemDom, pageAsset.asset.rotate);
		this.rotateRad = (pageAsset.asset.rotate || 0) * Math.PI / 180;
		this.radius = this.handles.circle.width() / 2;
		this.center = {
			top: ( corners.a.y + corners.c.y) / 2,
			left: ( corners.a.x + corners.c.x) / 2
		};
		this.handles.circle.css( this.center );
		this.handles.left.css({
			top: this.center.top - Math.sin( this.rotateRad ) * this.radius,
			left: this.center.left - Math.cos( this.rotateRad) * this.radius
		});
		this.handles.right.css({
			top: this.center.top + Math.sin( this.rotateRad ) * this.radius,
			left: this.center.left + Math.cos( this.rotateRad ) * this.radius
		});
	},
	show: function() {
		this.pageAsset = PB.ModelMap.model( this.assetId );
		this.handles = {
			circle: $("<div>").addClass('manipulator-circle'),
			left: Manipulator.makeIconHandle('repeat'),
			right: Manipulator.makeIconHandle('undo')
		};
		var THIS = this;
		for (var p in this.handles)
			$(document.body).append(this.handles[p]);
		this.handles.left.hammer()
			.on('dragstart', {}, function(ev) { THIS.dragstart(ev, 'left') })
			.on('drag', {}, function(ev) { THIS.drag(ev, 'left') })
			.on('dragend', {}, function(ev) { THIS.dragend(ev, 'left') });
		this.handles.right.hammer()
			.on('dragstart', {}, function(ev) { THIS.dragstart(ev, 'right') })
			.on('drag', {}, function(ev) { THIS.drag(ev, 'right') })
			.on('dragend', {}, function(ev) { THIS.dragend(ev, 'right') });
		var $itemDom = this.pageDom.find('*:data("model_id=' + this.assetId + '")');
		this.handles.circle.hammer()
			.on('touch', {}, function(ev) { $itemDom.hammer().trigger('touch', ev.gesture)});
		this.reposition();
	},
	remove: function() {
		for (var p in this.handles)
			this.handles[p].remove();
	},
	dragstart: function(ev) {
	},
	dragend: function(ev) {

	},
	drag: function(ev, side) {
		var xdiff = ev.gesture.center.pageX - this.center.left;
		var ydiff = ev.gesture.center.pageY - this.center.top;
		if (side == 'left') {
			xdiff = -xdiff;
			ydiff = -ydiff;
		}
		var angleRad;
		if ( xdiff == 0 )
			angleRad = ydiff > 0 ? Math.PI / 2 : 3 * Math.PI / 2;
		else
			angleRad = Math.atan(ydiff / xdiff);
		if ( xdiff < 0 )
			angleRad += Math.PI;
		if (angleRad < 0)
			angleRad += Math.PI * 2;
		this.pageAsset.page.updateAsset( this.assetId, {rotate: 180 * angleRad / Math.PI } );
		PB.stopEvent(ev.gesture);
	}
}

var ResizeManipulator = function($pageDom, assetId, options) {
	this.pageDom = $pageDom;
	this.assetId = assetId;
	this.options = $.extend( {
		vertical : true,
		horizontal: true,
		fixAspect: false
	}, options);
};

ResizeManipulator.prototype = {
	reposition: function(pageDom) {
		this.pageDom = pageDom || this.pageDom;
		var $itemDom = this.pageDom.find('*:data("model_id=' + this.assetId + '")');
		var pageAsset = PB.ModelMap.model(this.assetId);
		var corners = Manipulator.getBoundingCorners($itemDom, pageAsset.asset.rotate);

		this.rotateRad = (pageAsset.asset.rotate || 0) * Math.PI / 180;
		this.scale = Manipulator.scaleFromCorners(corners, pageAsset);
		this.handles.top.css({
			top: (corners.a.y + corners.b.y) / 2,
			left: (corners.a.x + corners.b.x) / 2,
			transform: 'rotate(' + this.rotateRad + 'rad)'
		});
		this.handles.bottom.css({
			top: (corners.c.y + corners.d.y) / 2,
			left: (corners.c.x + corners.d.x) / 2,
			transform: 'rotate(' + this.rotateRad + 'rad)'
		});
		this.handles.right.css({
			top: (corners.b.y + corners.c.y) / 2,
			left: (corners.b.x + corners.c.x) / 2,
			transform: 'rotate(' + this.rotateRad + 'rad)'
		});
		this.handles.left.css({
			top: (corners.d.y + corners.a.y) / 2,
			left: (corners.d.x + corners.a.x) / 2,
			transform: 'rotate(' + this.rotateRad + 'rad)'
		});
	},
	show: function() {
		this.pageAsset = PB.ModelMap.model( this.assetId );
		this.handles = {
			top: Manipulator.makeIconHandle('arrow-up'),
			left: Manipulator.makeIconHandle('arrow-left'),
			bottom: Manipulator.makeIconHandle('arrow-down'),
			right: Manipulator.makeIconHandle('arrow-right')
		};
		var THIS = this;
		for (var p in this.handles)
			$(document.body).append(this.handles[p]);
		this.handles.top.hammer()
			.on('dragstart', {}, function(ev) { THIS.dragstart(ev, 'top') })
			.on('drag', {}, function(ev) { THIS.drag(ev, 'top') })
			.on('dragend', {}, function(ev) { THIS.dragend(ev, 'top') });
		this.handles.bottom.hammer()
			.on('dragstart', {}, function(ev) { THIS.dragstart(ev, 'bottom') })
			.on('drag', {}, function(ev) { THIS.drag(ev, 'bottom') })
			.on('dragend', {}, function(ev) { THIS.dragend(ev, 'bottom') });
		this.handles.left.hammer()
			.on('dragstart', {}, function(ev) { THIS.dragstart(ev, 'left') })
			.on('drag', {}, function(ev) { THIS.drag(ev, 'left') })
			.on('dragend', {}, function(ev) { THIS.dragend(ev, 'left') });
		this.handles.right.hammer()
			.on('dragstart', {}, function(ev) { THIS.dragstart(ev, 'right') })
			.on('drag', {}, function(ev) { THIS.drag(ev, 'right') })
			.on('dragend', {}, function(ev) { THIS.dragend(ev, 'right') });
		if (!this.options.vertical) {
			this.handles.top.hide();
			this.handles.bottom.hide();
		}
		if (!this.options.horizontal) {
			this.handles.left.hide();
			this.handles.right.hide();
		}
		this.reposition();
	},
	remove: function() {
		for (var p in this.handles)
			this.handles[p].remove();
	},
	dragstart: function(ev) {
		this.pageAsset = PB.ModelMap.model(this.assetId);
		this.itemRect = {
			top: this.pageAsset.asset.css.top,
			left: this.pageAsset.asset.css.left,
			width: this.pageAsset.asset.css.width,
			height: this.pageAsset.asset.css.height
		};
	},
	dragend: function(ev) {

	},
	drag: function(ev, side) {
		var deltaXRot = ev.gesture.deltaX * Math.cos(this.rotateRad) + ev.gesture.deltaY * Math.sin(this.rotateRad);
		var deltaYRot = -ev.gesture.deltaX * Math.sin(this.rotateRad) + ev.gesture.deltaY * Math.cos(this.rotateRad);
		var newLoc = PB.clone( this.itemRect );
		var minHeight = 64;
		var minWidth = 64;
		var ratio = newLoc.width / newLoc.height;
		switch(side) {
			case 'top':
				if (minHeight > (newLoc.height - deltaYRot))
					deltaYRot = newLoc.height - minHeight;
				newLoc.top += (Math.cos( this.rotateRad ) + 1) * deltaYRot / 2;
				newLoc.left -= Math.sin( this.rotateRad ) * deltaYRot / 2;
				newLoc.height -= deltaYRot;
				if (this.options.fixAspect)
					newLoc.width -= deltaYRot * ratio;
			break;
			case 'bottom':
				if (minHeight > (newLoc.height + deltaYRot))
					deltaYRot = minHeight - newLoc.height;
				newLoc.top += ( Math.cos( this.rotateRad ) - 1) * deltaYRot / 2;
				newLoc.left -= Math.sin( this.rotateRad ) * deltaYRot / 2;
				newLoc.height += deltaYRot;
				if (this.options.fixAspect)
					newLoc.width += deltaYRot * ratio;
			break;
			case 'right':
				if (minWidth > (newLoc.width + deltaXRot))
					deltaXRot = -( newLoc.width - minWidth);
				newLoc.top += Math.sin( this.rotateRad ) * deltaXRot / 2;
				newLoc.left += (Math.cos( this.rotateRad ) - 1) * deltaXRot / 2;
				newLoc.width += deltaXRot;
				if (this.options.fixAspect)
					newLoc.height += deltaXRot / ratio;
			break;
			case 'left':
				if (minWidth > (newLoc.width - deltaXRot))
					deltaXRot = newLoc.width - minWidth;
				newLoc.top += Math.sin( this.rotateRad ) * deltaXRot / 2;
				newLoc.left += (Math.cos( this.rotateRad ) + 1) * deltaXRot / 2;
				newLoc.width -= deltaXRot;
				if (this.options.fixAspect)
					newLoc.height -= deltaXRot / ratio;
			break;
		}
		this.pageAsset.page.updateAsset( this.assetId, { css: newLoc } );
		PB.stopEvent(ev.gesture);
	}
}

var EditTextManipulator = function($pageDom, assetId) {
	this.pageDom = $pageDom;
	this.assetId = assetId;
};

EditTextManipulator.prototype = {
	reposition: function(pageDom) {
		this.pageDom = pageDom || this.pageDom;
		// console.log('reposition');
		var $itemDom = this.pageDom.find('*:data("model_id=' + this.assetId + '")');
		var $textDom = $itemDom.find('.design-text-content');
		var corners = Manipulator.getBoundingCorners($textDom, this.pageAsset.asset.rotate);
		var center = {
			x: (corners.a.x + corners.c.x) / 2,
			y: (corners.a.y + corners.c.y) / 2,
			width: $textDom.outerWidth(),
			height: $textDom.outerHeight()
		};
		this.handles.textarea.css({
			left: Math.max(0, ( center.x - center.width / 2) - 2 ),
			top: Math.max(0, ( center.y - center.height / 2) - 1 ),
			width: center.width,
			height: center.height
		});
		this.autogrow();
	},
	autogrow: function() {
		// console.log('autogrow');
		var textarea = this.handles.textarea.get(0);
		if (textarea.scrollHeight > textarea.clientHeight) {
			console.log('autogrow growing');
			var s = window.getComputedStyle(textarea);
			textarea.style.height = textarea.scrollHeight
				+ parseInt(s.getPropertyValue('border-top-width'))
				+ parseInt(s.getPropertyValue('border-bottom-width'))
				+ "px";
			if (textarea.scrollHeight > textarea.clientHeight) { // Firefox
				textarea.style.height = textarea.scrollHeight
					+ parseInt(s.getPropertyValue('padding-top'))
					+ parseInt(s.getPropertyValue('padding-bottom'))
					+ parseInt(s.getPropertyValue('border-top-width'))
					+ parseInt(s.getPropertyValue('border-bottom-width'))
					+ "px";
			}
		}
	},
	input: function() {
		// console.log('input');
		this.pageAsset.page.updateAsset( this.assetId, {
			content: this.handles.textarea.prop('value')
		});
		this.autogrow();
	},
	blur: function() {
		// console.log('blur');
		// only works well outside of touch
		PB.Page.Selection.findClosest( this.pageDom ).setManipulator();
	},
	show: function() {
		// console.log('show');
		this.pageAsset = PB.ModelMap.model( this.assetId );
		this.pageAsset.page.startTemporaryChanges();
		this.handles = {
			textarea: $( $.parseHTML('<textarea class="manipulator-textarea"></textarea>')),
			mirror: $('<pre>')
		};
		this.handles.textarea.prop('placeholder',
			this.pageAsset.page.getDummyText( this.pageAsset.asset ));
		var text = this.pageAsset.page.getText( this.pageAsset.page.getAsset( this.assetId ));
		if (text !== undefined)
			this.handles.textarea.prop('value', text);

		var THIS = this;
		this.handles.textarea
			.on('input', function() { THIS.input() } );
		$(document.body).append(this.handles.textarea);
		this.reposition();
		var THIS = this;
		window.setTimeout(function() {	// the timeout cascade to make selecting end work
			var dom = THIS.handles.textarea.get(0);
			dom.focus();
			window.setTimeout( function() {
				dom.setSelectionRange(36000, 36000);
			}, 0)
		}, 0);
	},
	remove: function() {
		// console.log('remove');
		this.handles.textarea.remove();
		this.pageAsset.page.endTemporaryChanges();
	}
}

scope.Manipulator = Manipulator;
scope.Manipulators = {
	Default: DefaultManipulator,
	Move: MoveManipulator,
	Pan: PanManipulator,
	Zoom: ZoomManipulator,
	Rotate: RotateManipulator,
	Resize: ResizeManipulator,
	EditText: EditTextManipulator
}

})(GUI);
