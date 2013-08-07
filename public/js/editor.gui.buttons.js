/* editor.gui.buttons.js
*/
(function(scope) {


	var Buttons = {
		init: function() {
			ResizePaletteButton.init();
		}
	}

	var lastMouse = 0;
	var yOffset = 0;	// Number to add to clientY to find center of the button
	var touchId = 0;
	var paletteRect = {};
	var ResizePaletteButton = {
		init: function() {
			paletteRect = document.getElementById('palette-resize-btn').getBoundingClientRect();
			if (PB.hasTouch()) {
				$('#palette-resize-btn').on({
					touchstart: function(ev) {
						ev = ev.originalEvent;
						touchId = ev.touches[0].identifier;
						ResizePaletteButton.startDrag(ev.touches[0].clientY);
					},
					touchmove: function(ev) {
						ev = ev.originalEvent;
						var newTouch = ResizePaletteButton.touchItemById(ev.changedTouches, touchId);
						if (!newTouch)

							return;
						else {
							ResizePaletteButton.continueDrag(newTouch.clientY);

							ev.preventDefault();
						}
					},
					touchend: function(ev) {
						touchId = 0;
						ResizePaletteButton.endDrag();
					},
					touchcancel: function(ev) {
						touchId = 0;
						ResizePaletteButton.endDrag();
					}
				});
			}
			else {
				$('#palette-resize-btn').on({
					mousedown: function(ev) {
						ResizePaletteButton.startDrag(ev.originalEvent.clientY);
						ev.stopPropagation();
						ev.preventDefault();
						$('body').mousemove(function(ev) {
							ev.stopPropagation();
							ev.preventDefault();
							ResizePaletteButton.continueDrag(ev.originalEvent.clientY)
						});
						$('body').mouseup(function(ev) {
							$('body').off('mousemove');
							$('body').off('mouseup');
							ev.stopPropagation();
							ev.preventDefault();
							ResizePaletteButton.endDrag(ev.originalEvent.clientY);
						});
					},
					click: function(ev) {
						ev.stopPropagation();
						ev.preventDefault();
					}
				});
			}
		},
		touchItemById: function(touchList, identifier) {
			for (var i=0; i<touchList.length; i++) {
				if (touchList[i].identifier == identifier)
					return touchList[i];
			}
			return null;
		},
		startDrag: function(clientY) {
			lastMouse = clientY;
			paletteRect = document.getElementById('palette-resize-btn').getBoundingClientRect();
			yOffset = paletteRect.top + paletteRect.height / 2 - clientY;
//			console.log('yOffset', yOffset);
		},
		continueDrag: function(clientY) {
			var heights = GUI.Palette.getPossibleHeights();
			var min = heights[0] / 2;
			var max = heights[heights.length -1];
			var mainRect = document.getElementById('main-content').getBoundingClientRect();
			var loc = GUI.Util.clamp(clientY,
				mainRect.top + min - yOffset,
				mainRect.top + max - yOffset);
//			console.log('clientY', clientY, 'mainRect.top', mainRect.top, 'loc', loc, 'yOffset', yOffset);
			var buttonTop = loc + yOffset - mainRect.top - paletteRect.height / 2;
//			console.log('buttonTop', buttonTop);
			$('#palette-resize-btn').css({top: buttonTop});
			GUI.Palette.setHeight(loc + yOffset - mainRect.top, false);
		},
		endDrag: function(clientY) {
		},
		fixPosition: function() {
			var paletteHeight = $('#palette:visible').length == 1 ? $('#palette').outerHeight() : 0;
			var pos = paletteHeight - paletteRect.height / 2;
			if (pos < paletteRect.height)
				$('#palette-resize-btn').hide();
			else
				$('#palette-resize-btn')
					.show()
					.css('top', $('#palette').outerHeight() - paletteRect.height / 2);
		}
	}

	var FireButton = function ($dom, options) {
		this.dom = $dom;
		this.fireCount = 0;	// how many times have we fired?
		this.active = false;
		this.options = $.extend( {
			start: null,
			stop: null,
			fire: null
		}, options);
		this.touchMode = false;
		this.initEventHandlers();
	}

	FireButton.prototype = {
		initEventHandlers: function() {
			this.dom.data('fire-handler', this)
				.on('touchstart.fire mousedown.fire', function($ev) {
					$($ev.currentTarget).data('fire-handler').start($ev);
				});
		},
		start: function($ev) {
			// console.log("firebutton.start", $ev.type);
			var THIS = this;
			// Do not listen to mouse events if touch is active
			if ($ev.type == 'touchstart') {
				this.touchmode = true;
				this.dom.off('mousedown.fire');
			}
			this.active = true;
			this.fireCount = 0;
			var stopEvents = $ev.type == 'touchstart' ? 'touchend.fire' : 'mouseup.fire'
			$(document.body).on(stopEvents, function($ev) {
				THIS.stop($ev);
			});
			if (this.options.start)
				this.options.start($ev, this.dom);
			else
				console.log('fire button start');
			this.fire();
			$ev.stopPropagation();
			$ev.preventDefault();
		},
		stop: function($ev) {
			// console.log("firebutton.stop", $ev ? $ev.type : "no event");
			if (this.options.stop)
				this.options.stop($ev, this.dom);
			this.active = false;
			$(document.body).off('touchend.fire mouseup.fire');
		},
		fire: function() {
			if (!this.active)
				return;
			var delay = 100;
			if (this.options.fire) {
				if ( this.touchmode && this.fireCount > 0) {
					this.stop();
					// console.log("no repeat fire on iOS because of delay issues");
				}
				else
					delay = this.options.fire(this.fireCount++);
			}
			var THIS = this;
			var startTime = Date.now();
			window.setTimeout(function() {
				// console.log("fired after", Date.now() - startTime);
				THIS.fire();
			}, delay);
		}
	}
	scope.Buttons = Buttons;
	scope.Buttons.ResizePaletteButton = ResizePaletteButton;
	scope.Buttons.FireButton = FireButton;

})(window.GUI);

