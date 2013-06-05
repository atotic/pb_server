// editor.gui.dnd.js

(function(scope) {

	var Draggable = function(el) {
		this.src = el;
	}


	var $currentDrag;
	var $src;
	var startLoc;

	var Events = {
		pageLocation: function($ev) {
			var ev = $ev.originalEvent;
			if ('targetTouches' in ev)
				return { x: ev.targetTouches[0].pageX, y: ev.targetTouches[0].pageY };
			else
				return { x: ev.pageX, y: ev.pageY };
		}
	}

	var Dnd = {
		dragStart: function(ev) {
			console.log('dragStart');
			var target = ev.currentTarget;
			$src = target;
			var bounds = target.getBoundingClientRect();
			// create a clone
			startLoc = Events.pageLocation(ev);
			$currentDrag = GUI.Util.cloneDomWithCanvas(target)
				.addClass('touch-drag-src')
				.removeClass('draggable')
				.css( {
					top: startLoc.y,
					left: startLoc.x,
					marginLeft: bounds.left - startLoc.x,
					marginTop: bounds.top - startLoc.y
				});
			$currentDrag.children().css('verticalAlign', 'top'); // eliminate LI whitespace
			$(document.body).append($currentDrag);
			// tracking events
			$(document).on('touchmove mousemove', Dnd.dragMove);
			$(document).on('touchend mouseup', Dnd.dragEnd);
		},
		dragMove: function(ev) {
			console.log('dragMove');
			var loc = Events.pageLocation(ev);
			ev.preventDefault();
			$currentDrag.css( {
				top: loc.y,
				left: loc.x
			});
		},
		dragEnd: function(ev) {
			console.log('dragEnd');
			$currentDrag.transition({
				top: startLoc.y,
				left: startLoc.x,
				duration: 150,
				complete: function() { $currentDrag.detach() }
			});
			$(document).off('touchmove mousemove touchend mouseup');
		}
	}

	$(document).on('touchstart mousedown', ".draggable", Dnd.dragStart );

})(GUI);
