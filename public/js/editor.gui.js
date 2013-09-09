// editor.gui.js
/*
	GUI Manipulation

GUI holds references to model objects in $(dom element).data('model_id')
Each dom element holding a model listens for PB.MODEL_CHANGED events
*/

/* HTML hierarchy
#top-menu
#sidebar
#main-content
	#palette
	#work-area
		#work-area-container
			#work-area-organize
			#work-area-theme
			#work-area-design
			#work-area-print
	#palette-resize-btn
*/

(function(window) {
"use strict";
		function stopEvent(ev) {
			ev.stopPropagation();
			ev.preventDefault();
		}

		var GUI = {
		init: function() {
			this.initGlobalShortcuts();
			window.setTimeout(function() {
				// One time sizing fix
				var menuBottom = document.getElementById('top-navbar').getBoundingClientRect().bottom;
				$('#main-content').css('top', menuBottom);
				GUI.fixSizes();
			},0);
			$('#main-content').data('resize', function(el) {
				$('#main-content').width($('body').width() - $('#sidebar').width());
			});
			$(window).on('resize', function($ev) {
				// console.log('window.resize');
				GUI.fixSizes($(document.body))
			});
			$('html').click(GUI.clearPopups);
			if ($(document.body).fullScreen() === null)
				$('#fullscreen').hide();
			GUI.Options.init();
			GUI.Buttons.init();
			GUI.CommandManager.init();
			GUI.Tools.init();
			GUI.Palette.init();
			GUI.WorkArea.init();
		},
		clearPopups: function(ev) {
			$('.pb-popup').remove();
		},
		// root can be undefined, selector,
		fixSizes: function(root) {
			root = root ? $(root) : $(document.body);
			$('*:data("resize")').each(function() {
				($(this).data('resize'))(this);
			});
		},
		initGlobalShortcuts: function() {
			var cs = new GUI.CommandSet("global");
			cs.add( new GUI.Command( {
				id: 'viewMoreImages',
				key: ['+', '='] ,
				action: function() {GUI.Palette.viewMore();}
			}));
			cs.add( new GUI.Command( {
				id: 'viewFewerImages',
				key: '-',
				action: function() {GUI.Palette.viewLess();}
			}));
			cs.add( new GUI.Command( {
				id: "HideTools",
				key: GUI.CommandManager.keys.esc,
				action: GUI.toggleTools
			}));
			GUI.CommandManager.addCommandSet(cs);
		},
		bindToBook: function(book) {
			$('body')
				.data('model_id', book.id)
				.on(PB.MODEL_CHANGED, function(ev, model, prop, options) {
					switch(prop) {
						case 'corrupted':
							GUI.Template.append($('#alert-container'), 'error-locked');
							$('#error-locked').slideDown();
							$('#lockedMessage').text(book.corrupted);
						break;
						case 'pleaseLoginError':
							GUI.Template.append($('#alert-container'), 'please-relogin');
							$('#please-relogin').slideDown();
						break;
						default:
						break;
					}
				});
			GUI.Palette.bindToBook(book);
			GUI.WorkArea.bindToBook(book);
			window.document.title = book.title + " PhotoBook";
		},
		toggleTools: function() {
			$('#rough-more-tools').stop(true).slideToggle(50, function() {
				if ($('#rough-more-tools:visible').length > 0)
					GUI.Tools.loadFromOptions();
			});
		}
	};
	window.GUI = GUI;

})(window);

// GUI Options
(function(scope) {
"use strict";
	var Options = {
		init: function() {
			this.fromHashbang();
		},
		_photoFilter: 'unused', // 'all' | 'unused'
		_photoSort: 'added', // 'added' | 'taken' | 'name'
		_photoSize: 'medium', // 'small' | 'medium' | 'large'
		_pageSize: 'medium', // 'small' | 'medium' | 'large'
		_designStage: 'organize', // 'organize' | 'design' | 'print'
		_designPage: null,
		get photoFilter() { return this._photoFilter; },
		get photoSort() { return this._photoSort; },
		get photoSize() { return this._photoSize; },
		get photoSizeHeight() {
			switch(this._photoSize) {
				case 'small':
					return 96;
				case 'medium':
					return 128;
				case 'large':
					return 196;
			}
		},
		get photoSizeWidth() {
			return this.photoSizeHeight * 1.5;
		},
		get pageSize() { return this._pageSize; },

		get pageSizePixels() {
			switch(this._pageSize) {
				case 'small':
					return 96;
				case 'medium':
					return 128;
				case 'large':
					return 196;
			}
		},
		set photoFilter(val) {
			if (val == this._photoFilter)
				return;
			this._photoFilter = val;
			this.broadcast('photoFilter', val);
		},
		set photoSort(val) {
			if (val == this._photoSort)
				return;
			this._photoSort = val;
			this.broadcast('photoSort', val);
		},
		set photoSize(val) {
			if (val == this._photoSize)
				return;
			this._photoSize = val;
			this.broadcast('photoSize', val);
		},
		set pageSize(val) {
			if (val == this._pageSize)
				return;
			this._pageSize = val;
			this.broadcast('pageSize', val);
		},
		get designStage() {
			return this._designStage;
		},
		set designStage(val) {
			this._designStage = val;
			this.broadcast('designStage', val);
			this.toHashbang();
		},
		get designPage() {
			return this._designPage;
		},
		set designPage(val) {
			this._designPage = val;
			this.broadcast('designPage', val);
			this.toHashbang();
		},
		toHashbang: function() {
			var hashStr = "";
			if (this.photoFilter != 'unused')
				hashStr += "photoFilter=" + this.photoFilter;
			if (this.photoSort != 'added')
				hashStr += '&photoSort=' + this.photoSort;
			if (this.photoSize != 'medium')
				hashStr += '&photoSize=' + this.photoSize;
			if (this.pageSize != 'medium')
				hashStr += '&pageSize=' + this.pageSize;
			if (this.designStage != 'organize')
				hashStr += '&designStage=' + this.designStage;
			if (this.designStage == 'design' && this._designPage)
				hashStr += '&designPage=' + this.designPage;
			hashStr = hashStr.replace(/^\&/, '');
			hashStr = '#' + hashStr;
			var newUrl = window.location.href.split('#',2)[0] + hashStr;
			window.location.replace(hashStr);
		},
		fromHashbang: function() {
			var hashSplit = window.location.href.split('#',2);
			if (hashSplit.length < 2)
				return;
			var ampSplit = hashSplit[1].split('&');
			var optNames = ['photoFilter', 'photoSize', 'photoSort', 'pageSize', 'designStage', 'designPage'];
			for (var i=0; i<ampSplit.length; i++) {
				var eqlSplit = ampSplit[i].split('=', 2);
				var idx = optNames.indexOf(eqlSplit[0])
				if (idx != -1)
					this[optNames[idx]] = eqlSplit[1];
			}
		}
	};
	$.extend(Options, PB.ListenerMixin);
	scope.Options = Options;
})(GUI);

(function(scope) {
	var Error = {
		photoTooBig: function(photo) {
			var bigAlert = $('#big-alert');
			if (bigAlert.length == 0) {
				var text = "<p>These photos are too big. Our current upload limit is 10MB.</p>";
				text += "<p>Try making your photos smaller by resizing them in the photo editor.</p>";
				text += "<p>The photos have been removed from the book.</p>";
				bigAlert = $(PB.error(text, 'alert-error'));
				bigAlert.prop('id', 'big-alert');
			}
			PB.Book.default.removePhoto(photo, {animate:true});
			var photoMsg = $("<p><img src='" + photo.iconUrl.url + "' style='height:128px'>" + photo.displayName() + "</p>");
			photoMsg.children('img')
				.data('model_id', photo.id)
				.on(PB.MODEL_CHANGED, function(ev, model, prop, options) {
					if (prop == 'icon_url')
						this.src = photo.iconUrl.url;
				});
			bigAlert.append(photoMsg);
		}
	};

	scope.Error = Error;

})(window.GUI);

// JQDiffUtil
// Helper functions for DOM manipulations of diffs
// Every function manipulates the dom, then modifies jq argument to match new dom
// Test: http://dev.pb4us.com/test/qunit/gui_jqdiffutil
(function(scope) {
	var JQDiffUtil = {
		// sets element at index to dom
		set: function(jq, index, newDom) {
			newDom = $(newDom);
			var oldDom = jq.get(index);
			if (!oldDom)
				throw console.error("JQDiffUtil set cannot find dom", arguments);
			$(oldDom).replaceWith(newDom);
			var elArry = jq.get();
			elArry.splice(index, 1, newDom.get(0));
			return $(elArry);
		},
		insert: function(jq, container, index, newDom) {
			var newJq;
			if (jq.length < index) {
				console.error("JSDiffUtil.insert out of range", arguments);
				throw new Error("JSDiffUtil.insert out of range");
			}
			if (jq.length == index) {
				if (jq.length == 0) {
					container.prepend(newDom);
					newJq = $(newDom);
				}
				else {
					jq.last().after(newDom);
					newJq = jq.add(newDom);
				}
			}
			else {
				$(jq.get(index)).before(newDom);
				var elArry = jq.get();
				elArry.splice(index, 0, newDom.get(0));
				newJq = $(elArry);
			}
			return newJq;
		},
		delete: function(jq, index, noDetach) {
			var el = jq.get(index);
			if (!el) {
				console.error('JSDiffUtil.delete non-existent element', arguments);
				throw 'JSDiffUtil.delete non-existent element';
			}
			if (!noDetach)
				$(el).remove();
			var elArry = jq.get();
			elArry.splice(index, 1);
			return $(elArry);
		},
		swap: function(jq, src, dest) {
			src = $(src);
			dest = $(dest);
			GUI.Util.swapDom(src.get(0), dest.get(0));
			var elArry = jq.get();
			var srcIdx = elArry.indexOf(src.get(0));
			var destIdx = elArry.indexOf(dest.get(0));
			elArry[srcIdx] = dest.get(0);
			elArry[destIdx] = src.get(0);
			return $(elArry);
		}
	};

	scope.JQDiffUtil = JQDiffUtil;
})(GUI);

// Template. javascript templates
// Inspirations: https://github.com/trix/nano/blob/master/jquery.nano.js
// http://ejohn.org/blog/javascript-micro-templating/
// Templates are in <script type='text/html' id='<div_id>-template'>
(function(scope) {
	var Template = {
		get: function(templateId, data, options) {
			options = $.extend({assignId: false}, options);
			var template = $('#' + templateId + '-template');
			if (template.length != 1)
				return console.warn("No such template", templateId);
			var text = template.html();
			if (data) {
				text = text.replace(/\{([\w\.]*)\}/g, function (str, key) {
					var keys = key.split(".")
					var value = data[keys.shift()];
					$.each(keys, function () { value = value[this]; });
					return (value === null || value === undefined) ? "" : value;
				});
			}
			var dom = $($.parseHTML(text)).filter(function() { return this.nodeType == 1});
			if (options.assignId)
				dom.attr('id', templateId);
			return dom.get(0);
		},
		append: function(parent, templateId, data) {
			var el = $('#' + templateId);
			if (el.length == 1)
				return el;
			el = $(Template.get(templateId, data, {assignId: true}));
			if (parent == null)
				parent = $('body');
			parent.append(el);
			return el;
		}
	}
	scope.Template = Template;
})(GUI);

if (!('Mixin' in GUI))
	GUI.Mixin = {};
/* DelayUntilVisible mixin
	Used to delay functions that should only execute when visible
	Framework sends 'pbShow' event when element is visible.
	Call processDelayUntilVisible in the event handler

Usage:
	init: function() {
		// initialize event handlers
		$('#blah').on('pbShow', function() {
			this.processDelayUntilVisible();
		}
	}
	executeOnlyWhenVisible: function(arg1, arg2) {
		// function should only execute when visible
		var dom = $('#blah')
		if (this.delayUntilVisible(dom, this.executeOnlyWhenVisible, [arg1, arg2]))
			return;
	}
*/
(function(scope) {
	var DelayUntilVisible = {
		delayUntilVisible: function(dom, func, args) {
			if ($(dom).is(':visible'))
				return false;
			this._delayUntilVisible = this._delayUntilVisible || [];
			this._delayUntilVisible.push({func: func, args: args});
			return true;
		},
		processDelayUntilVisible: function() {
			if (!('_delayUntilVisible' in this))
				return;
			var op;
			while (op = this._delayUntilVisible.shift())
				op.func.apply(this, op.args);
		},
	}

	scope.DelayUntilVisible = DelayUntilVisible;

})(GUI.Mixin);

(function(scope){
	var Rotated2DContext = function(context, angleRad) {
		this.context = context;
		this.angle = angleRad;
	}

	Rotated2DContext.prototype = {
		fillRect: function(x,y,w,h) {
			if (this.angle) {
				this.context.save();
				this.context.translate( x + w/2, y + h/2 );
				this.context.rotate(this.angle);
				this.context.fillRect( -w/2, -h/2, w, h );
				this.context.restore();
			}
			else
				this.context.fillRect(x,y,w,h);
		},
		strokeRect: function(x,y,w,h) {
			if (this.angle) {
				this.context.save();
				this.context.translate( x + w/2, y + h/2 );
				this.context.rotate(this.angle);
				this.context.strokeRect(-w/2, -h/2, w, h );
				this.context.restore();
			}
			else
				this.context.fillRect(x,y,w,h);
		},
		drawImage: function(img, x,y,w,h) {
			if (this.angle) {
				if (w == 0)
					w = img.width;
				if (h == 0)
					h = img.height;
				this.context.save();
				this.context.translate( x + w/2, y + h/2 );
				this.context.rotate(this.angle);
				this.context.drawImage(img, -w/2, -h/2, w, h );
				this.context.restore();
			}
			else
				this.context.drawImage(img, x,y,w,h);
		},

	}
	scope.Rotated2DContext = Rotated2DContext;
})(GUI);
