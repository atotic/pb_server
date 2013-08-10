// editor.pb.page.selection.js

(function(scope) {
"use strict";

// Special event fires when dom element has been removed
// The only documentation I've found for jQuery special events
// http://benalman.com/news/2010/03/jquery-special-events/
// Use it to clean up selection when page is removed
$.event.special.pageRemoved = {
	remove: function( handleObj ) {
		var sel = $(this).data('page-selection');
		if (sel)
			sel.setSelection();
		return false;
	}
}

// Editable pages have selection attached to their dom.data('page-selection')
//
var PageSelection = function(page, dom) {
	this.page = page;
	this.dom = dom;
	this.selection = [];	// array of asset ids
	this.manipulator = null;
	this.commandSet = null;
	this._clickTime = 0;
};

PageSelection.prototype = {
	get clickTime() {
		return this._clickTime;
	},
	set clickTime(val) {
		this._clickTime = val;
		this.broadcast('clickTime')
	},
	setSelection: function(assetId, commandSet, options) {
		options = $.extend({
			updateClickTime: false
		}, options);
		if (options.updateClickTime)
			this.clickTime = Date.now();
		var newSelection = assetId ? [assetId] : [];
		if (newSelection.toString() != this.selection.toString()) {
			this.selection = newSelection;
			this.highlight();
			// hide manipulator if from another item
			if (this.manipulator && this.manipulator.assetId != assetId)
			 	this.setManipulator(null);
			// if ($popup != null && $popup.length == 0)
			// 	$popup = null;
			this.commandSet = commandSet;
			this.broadcast('selection', this.selection);
		}
	},

	highlight: function() {
		this.dom.find('.selected').removeClass('selected');
		for (var i=0; i<this.selection.length; i++)
			this.dom.find('*:data("model_id=' + this.selection[i] + '")').addClass('selected');
	},
	setManipulator: function(manipulator) {
		if (this.manipulator)
			this.manipulator.remove();
		this.manipulator = manipulator;
		if (this.manipulator)
			this.manipulator.show();
	},
	relayout: function() {
		if (this.manipulator)
			this.manipulator.reposition(this.dom);
	},
	store: function() {
		var retVal = {
			selection: this.selection,
			manipulator: this.manipulator,
			commandSet: this.commandSet
		};
		this.manipulator = null;
		return retVal;
	},
	restore: function(state) {
		// restores selection stored with save
		this.setSelection(
			state.selection.length > 0 ? state.selection[0] : null, state.commandSet);
		this.manipulator = state.manipulator;
		this.relayout();
	}
};
$.extend( PageSelection.prototype, PB.ListenerMixin);

// Global functions
$.extend( PageSelection, {
	bindToDom: function(page, $dom) {
		var sel = $dom.data('page-selection');
		if (sel) {
			debugger;
			sel.highlight();
		}
		else {
			sel = new PageSelection(page, $dom);
			$dom.data('page-selection', sel);
			$dom.on('pageRemoved', this, function() {
				// triggered by designPage before flipping
				var sel = $(this).data('page-selection');
				if (sel)
					sel.setSelection();
			});
		}
		return sel;
	},
	findClosest: function($dom) {
		var ps = $dom.data('page-selection') ||
			$dom.parents( '*:data("pageSelection")' ).data('page-selection');
		if (ps == null) {
			console.error("could not find pageselection in ", $dom);
			throw new Error("Could not find pageselection");
		}
		return ps;
	},
	// return [PageSelection]
	getActiveSelections: function() {
		var retVal = [];
		$('.selected').each(function() {
			var s = PageSelection.findClosest($(this));
			if (s)
				retVal.push(s);
		});
		return retVal;
	},
	forEach: function(callback) {
		// callback(PB.PageProxy, assetId)
		this.getActiveSelections()
			.forEach( function( pageSel ) {
				pageSel.selection.forEach( function( assetId ) {
					callback(pageSel.page, assetId, pageSel);
				});
			});
	},
	clear: function() {
		PageSelection.getActiveSelections().forEach( function( sel ) {
			sel.setSelection();
		});
	}
});


scope.Selection = PageSelection;

})(PB.Page)
