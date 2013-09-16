// editor.gui.options.js

// GUI Options
// Some options store their values in hashbang
// Use: GUI.Options.addListener( function( optionName, optionValue ))
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
				case 'xlarge':
					return 260;
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
