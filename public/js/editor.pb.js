/* editor.pb.js
PB stands for PhotoBook
Common code, used by mobile and desktop

window.PB // Generic utilities
*/

// PB, general utility routines
(function(window) {
"use strict";


	var PB = {
		init: function() {
			$.event.special[this.MODEL_CHANGED] = {noBubble: true};
		},
		clone: function(obj) {
			return JSON.parse(JSON.stringify(obj));
		},
		randomString: function (len, charSet) {
			charSet = charSet || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
			var randomString = '';
			for (var i = 0; i < len; i++) {
					var randomPoz = Math.floor(Math.random() * charSet.length);
					randomString += charSet.substring(randomPoz,randomPoz+1);
			}
			return randomString;
		},
		// changes to DOM broadcasts

		MODEL_CHANGED: 'modelchanged',
		startChangeBatch: function() {
			this._changeBatch = [];
		},
		broadcastChangeBatch: function() {
			var batch = this._changeBatch;
			delete this._changeBatch;
			var filter = $('*:data("model_id")');
			var dataMapper = {};
			filter.each(function() {
				var id = $.data(this,'model_id');
				if (id in dataMapper)
					dataMapper[id].push(this);
				else
					dataMapper[id] = [this];
			});
			for (var i=0; i < batch.length; i++) {
				this.broadcastChange(batch[i].model, batch[i].propName, batch[i].options, dataMapper);
			}
		},
		cancelChangeBatch: function() {
			delete this._changeBatch;
		},
		broadcastChange: function(model, propName, options, dataMapper) {
			if (this._changeBatch)
				this._changeBatch.push({model:model, propName:propName, options:options});
			else {
				try {
					if (dataMapper) {
						if (model.id in dataMapper)
							for (var i=0; i<dataMapper[model.id].length; i++)
								$(dataMapper[model.id][i]).trigger(PB.MODEL_CHANGED, [model, propName, options]);
					}
					else {
						var filter = $('*:data("model_id")');
						filter.filter('*:data("model_id=' + model.id + '")')
							.trigger(PB.MODEL_CHANGED, [model, propName, options]);
				}
				} catch(ex) {
					debugger;
				}
			}
		}
	};

	if (! ('PB' in window)) window.PB = {};

	$.extend(window.PB, PB);

})(window);

// PB.ModelMap: maps model ids to models
// We store model ids, beause models cannot be stored, they can be deleted and recreated
// by the patching code
(function(scope) {
"use strict";

	var objectCache = []; // objects cached by
	var resolverCache = [];

	var ModelMap = {
		model: function(id) {
			return objectCache[id] || (resolverCache[id] || $.noop)(id)
		},
		set: function(model) {
			objectCache[model.id] = model;
		},
		setResolver: function(model_id, resolver) {
			resolverCache[model_id] = resolver;
		},
		unsetResolver: function(model_id) {
			if (model_id in resolverCache)
				delete resolverCache[model_id];
			else
				console.warn("unsetResolver of not-registered resolver");
		},
		domToModel: function(el) {
			try {
				var e = el.nodeType ? el : el.get(0);
				if (e)
					return this.model($.data(e, 'model_id'));
				else
					return undefined;
			}
			catch(ex) {
				console.warn(ex.message);
				debugger;
			}
			return undefined;
		}
	};
	scope.ModelMap = ModelMap;

})(PB);

// ListenerMixin: extend objects with addListener/removeListener pattern
(function(scope) {
"use strict";
	var ListenerMixin = {
		// listener: function(propertyName, newValue)
		addListener: function(listener) {
			if (!this._listeners) this._listeners = [];
			var idx = this._listeners.indexOf(listener);
			if (idx == -1)
				this._listeners.push(listener);
		},
		removeListener: function(listener) {
			if (!this._listeners) return;
			var idx = this._listeners.indexOf(listener);
			if (idx != -1)
				this._listeners.splice(idx, 1);
			else
				console.warn('Removing non-existent listener',listener);
		},
		broadcast: function(propName, propVal) {
			if (!this._listeners) return;
			try {
				for (var i=0; i<this._listeners.length; i++)
					this._listeners[i](propName, propVal);
			}
			catch(ex) {
				console.error("Unexpected error broadcasting options", ex);
			}
		}
	};
	scope.ListenerMixin = ListenerMixin;
})(PB);

