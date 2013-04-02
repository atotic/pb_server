// editor.gui.popup.js

(function(scope) {

"use strict";

var Popup = function($el) {
	this.el = $el;
};

var OPEN_CLASS = 'pbopen';
var DATA_ID = 'pbPopup';
var POPUP_CLASS = 'pb-popup-menu';

function unregisterEventHandlers() {
	$(document.body).hammer().off("touch.pbPopup");
	$(document.body).hammer().off("drag.pbPopup");
	$(document.body).hammer().off("release.pbPopup");
};
function registerEventHandlers() {

	function getPopupAnchor(ev) {
		var x = ('gesture' in ev) ? ev.gesture.center.pageX : ev.pageX;
		var y = ('gesture' in ev) ? ev.gesture.center.pageY : ev.pageY;
		x -= window.pageXOffset;
		y -= window.pageYOffset;
		var el = document.elementFromPoint(x,y);
		if (!el)
			return null;
		var popup = $(el).parents('.pb-popup-menu');
		if (popup.length == 0)
			return null;
		if (el.nodeName.match(/^[aA]$/))
			return $(el);
		else {
//			console.log('no popup, node was', el.nodeName);
		}
		return null;
	};

	var ignoreFirstStart = true;
	var ignoreFirstStop = true;

	function cleanup() {
		$(document.body).find('.pbopen').removeClass('pbopen');
		unregisterEventHandlers();
	}

	function start(ev) {
//		console.log('start');
		if (ignoreFirstStart) {
			ignoreFirstStart = false;
			// console.log("ignoring start");
			return;
		}
		var $a = getPopupAnchor(ev);
		if ($a) {
			$a.parents('.pb-popup-menu').find('a').not($a).removeClass('pb-hover');
			$a.addClass('pb-hover');
			// console.log("anchor click");
		}
		else {
			// console.log("out of menu click, closing");
			cleanup();
		}
	};

	function stop(ev) {
//		console.log('stop');
		var $a =  getPopupAnchor(ev);
		if ($a) {
//			console.log("anchor click");
			$a.trigger('popupClick');
			('gesture' in ev) ? PB.stopEvent(ev.gesture.srcEvent) : PB.stopEvent(ev);
			cleanup();
		}
		else {
			if (ignoreFirstStop) {
				ignoreFirstStop = false;
				return;
			}
			cleanup();
//			console.log("click, no anchor");
		}
	};

	function move(ev) {
		var $a = getPopupAnchor(ev);
		if ($a) {
//			console.log('move highlight');
			$a.parents('.pb-popup-menu').find('a').not($a).removeClass('pb-hover');
			$a.addClass('pb-hover');
		}
		else {
//			console.log('move clear');
			$('.pb-popup-menu').find('.pb-hover').removeClass('pb-hover');
		};
		('gesture' in ev ? ev.gesture.srcEvent : ev).preventDefault();
	};

	unregisterEventHandlers();
	$(document.body).hammer()
		.on("touch.pbPopup", start)
		.on("drag.pbPopup mouseover.pbPopup", move)
		.on("release.pbPopup", stop);
};

Popup.prototype = {
	show: function() {
		$(document.body).find('.pbopen').not(this.el).removeClass('pbopen');
		this.el.find('a').removeClass('pb-hover');
		this.el.addClass('pbopen');
		registerEventHandlers();
	},
	hide: function() {
		this.el.removeClass('pbopen');
	},
	toggle: function() {
		if (this.el.hasClass('pbopen'))
			this.el.hide();
		else
			this.el.show();
	}
};

$.fn.pbPopup = function(opcode, args) {
	return this.each( function() {
		var $this = $( this );
		var	pop = $this.data( 'pbPopup' );
		if ( !pop ) {
			pop = new Popup( $this);
			$this.data('pbPopup',  pop);
			// $this.find('a').on('touchstart touchend touchmove touchenter touchleave touchcancel', function(ev) {
			// 	console.log(ev.type);
			// });
				// .on('mouseover touchenter', function(ev) {
				// 	$(this).addClass('pb-hover');
				// 	console.log('highlight', ev.type);
				// })
				// .on('mouseout touchleave', function(ev) {
				// 	$(this).removeClass('pb-hover');
				// 	console.log('no highlight', ev.type);
				// })
		}
		pop[opcode](args);
	});
};


})(GUI);


function initTouchHandlers() {
	$(document.body).on('touchstart touchend touchmove touchenter touchleave touchcancel',
		function(ev) {
			var e = ev.originalEvent;
			console.log('document', e.type, e.target, e.currentTarget);
			for (var i=0; i< e.touches.length; i++) {
				var touch = e.touches.item(i);
				console.log('touch',e.target);
			}
		});
	$('.design-page').on('touchstart touchend touchmove touchenter touchleave touchcancel',
	function(ev) {
		var e = ev.originalEvent;
		console.log('dp', e.type, e.target, e.currentTarget);
		for (var i=0; i< e.touches.length; i++) {
			var touch = e.touches.item(i);
			console.log('dp touch',e.target);
		}
	});
}

$(document).ready(function() {
	//window.setTimeout(initTouchHandlers, 2);
});
