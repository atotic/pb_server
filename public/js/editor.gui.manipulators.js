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
	},
	show: function() {
		this.handle = Manipulator.makeIconHandle('move');
		this.handle.find('i').css('color', '#CFC');
		$(document.body).append(this.handle);
		var THIS = this;
		this.handle.hammer()
			.on('dragstart', {}, function(ev) { THIS.dragstart(ev) })
			.on('drag', {}, function(ev) { THIS.drag(ev) })
			.on('dragend', {}, function(ev) { THIS.dragend(ev) });
		this.manipulatorOffset = { x:0, y:0};
		this.reposition();
	},
	remove: function() {
		this.handle.remove();
	},
	dragstart: function(ev) {
		// TODO normalize focalPoint
		this.manipulatorOffset = { x:0, y:0};
		this.pageItem = PB.ModelMap.model(this.itemId);
		this.focalPoint = this.pageItem.item.focalPoint ?
			PB.clone( this.pageItem.item.focalPoint )
			: { x: 50, y: 50};
		this.focalScale = {
			x: this.pageItem.item.photoRect.width / 100,
			y: this.pageItem.item.photoRect.height / 100 };
		ev.gesture.srcEvent.preventDefault();
	},
	dragend: function(ev) {
		this.manipulatorOffset = { x:0, y:0 };
		this.reposition();
	},
	drag: function(ev) {
		var x = this.focalPoint.x - ev.gesture.deltaX * this.scale / this.focalScale.x;
		var y = this.focalPoint.y - ev.gesture.deltaY * this.scale / this.focalScale.y;
		var range = this.pageItem.page.getFocalPointRange( this.itemId );
		if (x < range.x.min || x > range.x.max)
			x = -1;
		if (y < range.y.min || y > range.y.max)
			y = -1;
		var focalPoint = {};
		if (x != -1) {
			focalPoint.x = x;
			this.manipulatorOffset.x = ev.gesture.deltaX;
		}
		if (y != -1) {
			focalPoint.y = y;
			this.manipulatorOffset.y = ev.gesture.deltaY;
		}
		// constrain
		// top = Math.max( -this.pageItem.item.height / 2, top);
		// left = Math.max( -this.pageItem.item.width / 2, left);
		// top = Math.min( this.pageItem.page.height - this.pageItem.item.height / 2, top);
		// left = Math.min( this.pageItem.page.width - this.pageItem.item.width / 2, left);
		this.pageItem.page.updateAssetData( this.itemId, {focalPoint: focalPoint } );
		ev.gesture.srcEvent.preventDefault();
	}

};
scope.Manipulator = Manipulator;
scope.Manipulators = {
	Default: DefaultManipulator,
	Move: MoveManipulator,
	Pan: PanManipulator
}

})(GUI);
