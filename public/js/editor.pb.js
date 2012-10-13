/* editor.pb.js
PB stands for PhotoBook
Common code, used by mobile and desktop

window.PB // Generic utilities
window.PB.Book // Book access
window.PB.Photo // Photo objects
*/

// PB, general utility routines
(function(window) {
"use strict";

	var changeListeners = {};

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
		MODEL_CHANGED: 'modelchanged',
		startChangeBatch: function() {
			this._changeBatch = [];
		},
		broadcastChangeBatch: function() {
			var batch = this._changeBatch;
			delete this._changeBatch;
			var filter = $('*:data("model")');
			var dataMapper = {};
			filter.each(function() {
				var id = $.data(this,'model').id;
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
						var filter = $('*:data("model")');
						filter.filter('*:data("model.id=' + model.id + '")').trigger(PB.MODEL_CHANGED, [model, propName, options]);
				}
				} catch(ex) {
					debugger;
				}
				if (model.id in changeListeners)
					for (var i=0; i<changeListeners[model.id].length; i++)
						changeListeners[model.id][i].handleChangeEvent(model, propName, options);
			}
		},
		bindChangeListener: function(id, listener) {
			if (id in changeListeners)
				changeListeners[id].push(listener);
			else
				changeListeners[id] = [listener];
		},
		unbindChangeListener: function(id, listener) {
			if (id in changeListeners) {
				var idx = changeListeners[id].indexOf(listener);
				if (idx != -1) {
					changeListeners[id].slice(idx, 1);
					if (changeListeners[id].length === 0)
						delete changeListeners[id];
				}
				else
					console.warn("could not unregister listener");
			}
		}
	};

	if (! ('PB' in window)) window.PB = {};

	$.extend(window.PB, PB);

})(window);


