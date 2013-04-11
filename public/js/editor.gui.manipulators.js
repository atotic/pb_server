// editor.gui.manipulators.js

(function(scope) {

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
	scaleFromCorners: function(corners, pageItem) {
		var width = Math.sqrt(
			Math.pow(corners.b.y - corners.a.y, 2) +
			Math.pow(corners.b.x - corners.a.x, 2));
		return pageItem.item.width / width;
	}
}

var DefaultManipulator = function($pageDom, itemId) {
	this.pageDom = $pageDom;
	this.itemId = itemId;
}

DefaultManipulator.prototype = {
	reposition: function() {
		var $itemDom = this.pageDom.find('*:data("model_id=' + this.itemId + '")');
		var pageItem = PB.ModelMap.model(this.itemId);
		var corners = Manipulator.getBoundingCorners($itemDom, pageItem.item.rotate);
		this.handles.a.css({ top: corners.a.y, left: corners.a.x });
		this.handles.b.css({ top: corners.b.y, left: corners.b.x });
		this.handles.c.css({ top: corners.c.y, left: corners.c.x });
		this.handles.d.css({ top: corners.d.y, left: corners.d.x });
		this.scale = Manipulator.scaleFromCorners( corners, pageItem );
		console.log(this.scale);
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

MoveManipulator = function($pageDom, itemId) {
	this.pageDom = $pageDom;
	this.itemId = itemId;
}
MoveManipulator.prototype = {
	reposition: function() {
		var $itemDom = this.pageDom.find('*:data("model_id=' + this.itemId + '")');
		var pageItem = PB.ModelMap.model(this.itemId);
		var corners = Manipulator.getBoundingCorners($itemDom, pageItem.item.rotate);
		this.handle.css({
			top: (corners.c.y + corners.a.y) / 2,
			left: (corners.c.x + corners.a.x) / 2
		});
		this.scale = Manipulator.scaleFromCorners(corners, pageItem);
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
		this.pageItem = PB.ModelMap.model(this.itemId);
		this.startPos = { top: this.pageItem.item.top, left: this.pageItem.item.left };
	},
	drag: function(ev) {
		var top = this.startPos.top + ev.gesture.deltaY * this.scale;
		var left = this.startPos.left + ev.gesture.deltaX * this.scale;
		// constrain
		top = Math.max( -this.pageItem.item.height / 2, top);
		left = Math.max( -this.pageItem.item.width / 2, left);
		top = Math.min( this.pageItem.page.height - this.pageItem.item.height / 2, top);
		left = Math.min( this.pageItem.page.width - this.pageItem.item.width / 2, left);
		this.pageItem.page.updateAssetData( this.itemId, {
			top: top,
			left: left
		});
		ev.gesture.srcEvent.preventDefault();
	}
};

PanManipulator = function($pageDom, itemId) {
	this.pageDom = $pageDom;
	this.itemId = itemId;
};

PanManipulator.prototype = {
	reposition: function() {
		var $itemDom = this.pageDom.find('*:data("model_id=' + this.itemId + '")');
		var pageItem = PB.ModelMap.model(this.itemId);
		var corners = Manipulator.getBoundingCorners($itemDom, pageItem.item.rotate);
		this.handle.css({
			top: (corners.c.y + corners.a.y) / 2 + this.manipulatorOffset.y,
			left: (corners.c.x + corners.a.x) / 2 + this.manipulatorOffset.x
		});
		this.scale = Manipulator.scaleFromCorners(corners, pageItem);
		this.rotateRad= (pageItem.item.rotate || 0) * Math.PI / 180;
	},
	show: function() {
		this.handle = Manipulator.makeIconHandle('hand-up');
//		this.handle.find('i').css('color', '#CFC');
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
		this.pageItem = PB.ModelMap.model(this.itemId);
		this.focalPoint = $.extend( { x:50, y:50}, this.pageItem.item.focalPoint );
		this.focalScale = {
			x: this.pageItem.item.photoRect.width / 100,
			y: this.pageItem.item.photoRect.height / 100 };
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
		var range = this.pageItem.page.getFocalPointRange( this.itemId );
		focalX = GUI.Util.clamp( focalX, range.x.min, range.x.max);
		focalY = GUI.Util.clamp( focalY, range.y.min, range.y.max);

		var manipulatorRotLoc = {
			x: -( focalX - this.focalPoint.x ) * this.focalScale.x / this.scale,
			y: -(focalY - this.focalPoint.y ) * this.focalScale.y / this.scale
		};

		this.manipulatorOffset.x = manipulatorRotLoc.x * Math.cos(-this.rotateRad) + manipulatorRotLoc.y * Math.sin(-this.rotateRad);
		this.manipulatorOffset.y = -manipulatorRotLoc.x * Math.sin(-this.rotateRad) + manipulatorRotLoc.y * Math.cos(-this.rotateRad);

		var focalPoint = { x: focalX, y: focalY };
		this.pageItem.page.updateAssetData( this.itemId, {focalPoint: focalPoint } );
		ev.gesture.srcEvent.stopPropagation();
		ev.gesture.srcEvent.preventDefault();
	}
};

ZoomManipulator = function($pageDom, itemId) {
	this.pageDom = $pageDom;
	this.itemId = itemId;
};

ZoomManipulator.prototype = {
	reposition: function() {
		var $itemDom = this.pageDom.find('*:data("model_id=' + this.itemId + '")');
		var pageItem = PB.ModelMap.model(this.itemId);
		var corners = Manipulator.getBoundingCorners($itemDom, pageItem.item.rotate);
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
	},
	show: function() {
		this.pageItem = PB.ModelMap.model( this.itemId );
		this.handles = {
			zoom: Manipulator.makeIconHandle('search').addClass('label'),
			left: Manipulator.makeIconHandle('resize-horizontal'),
			right: Manipulator.makeIconHandle('resize-horizontal')
		};
		for (p in this.handles)
			$(document.body).append(this.handles[p]);
		var THIS = this;
		this.handles.left.hammer()
			.on('dragstart', {}, function(ev) { THIS.dragstart(ev, 'left') })
			.on('drag', {}, function(ev) { THIS.drag(ev, 'left') })
			.on('dragend', {}, function(ev) { THIS.dragend(ev, 'left') })
			.on('pinch', {}, function(ev) { THIS.pinch(ev, 'right') });

		var $itemDom = this.pageDom.find('*:data("model_id=' + this.itemId + '")');

		$itemDom.hammer().on('pinch', {}, function(ev) { THIS.pinch(ev, 'left') });

		this.handles.right.hammer()
			.on('dragstart', {}, function(ev) { THIS.dragstart(ev, 'right') })
			.on('drag', {}, function(ev) { THIS.drag(ev, 'right') })
			.on('dragend', {}, function(ev) { THIS.dragend(ev, 'right') })
			.on('pinch', {}, function(ev) { THIS.pinch(ev, 'right') });
		this.manipulatorOffset = 0;
		this.reposition();
	},
	remove: function() {
		for (p in this.handles)
			this.handles[p].remove();
		var $itemDom = this.pageDom.find('*:data("model_id=' + this.itemId + '")');
		$itemDom.hammer().off('pinch');
	},
	dragstart: function(ev) {
		this.manipulatorOffset = 0;
		this.zoom = this.pageItem.item.zoom || 1;
		this.zoomPerPixel = this.zoom / this.pageItem.item.photoRect.width * 2;
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
		this.pageItem.page.updateAssetData( this.itemId, {zoom: newZoom } );
		PB.stopEvent( ev.gesture.srcEvent );
	},
	pinch: function(ev) {
		// Pinch does not work quite right yet
		this.zoom = this.pageItem.item.zoom || 1;
		this.zoomPerPixel = this.zoom / this.pageItem.item.photoRect.width * 2;
		var newZoom = this.zoom * ev.gesture.scale;
		newZoom = Math.min( Math.max(1, newZoom), 10 );
		console.log("pinch", newZoom);
		this.manipulatorOffset = ( newZoom - this.zoom ) / this.zoomPerPixel;
		this.pageItem.page.updateAssetData( this.itemId, {zoom: newZoom } );
		PB.stopEvent(ev.gesture);
	}
};

scope.Manipulator = Manipulator;
scope.Manipulators = {
	Default: DefaultManipulator,
	Move: MoveManipulator,
	Pan: PanManipulator,
	Zoom: ZoomManipulator
}

})(GUI);
