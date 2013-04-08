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
	makeHandle: function(text) {
		return $('<div>')
			.addClass('manipulator-btn')
			.text(text);
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
	},
	show: function() {
		this.handles = {
			a: Manipulator.makeHandle('A'),
			b: Manipulator.makeHandle('B'),
			c: Manipulator.makeHandle('C'),
			d: Manipulator.makeHandle('D')
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

scope.Manipulator = Manipulator;
scope.DefaultManipulator = DefaultManipulator;

})(GUI);
