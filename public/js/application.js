var BrowserDetect = { // http://www.quirksmode.org/js/detect.html
	init: function () {
		this.browser = this.searchString(this.dataBrowser) || "An unknown browser";
		this.version = this.searchVersion(navigator.userAgent)
			|| this.searchVersion(navigator.appVersion)
			|| "an unknown version";
		this.OS = this.searchString(this.dataOS) || "an unknown OS";
	},
	searchString: function (data) {
		for (var i=0;i<data.length;i++)	{
			var dataString = data[i].string;
			var dataProp = data[i].prop;
			this.versionSearchString = data[i].versionSearch || data[i].identity;
			if (dataString) {
				if (dataString.indexOf(data[i].subString) != -1)
					return data[i].identity;
			}
			else if (dataProp)
				return data[i].identity;
		}
	},
	searchVersion: function (dataString) {
		var index = dataString.indexOf(this.versionSearchString);
		if (index == -1) return;
		return parseFloat(dataString.substring(index+this.versionSearchString.length+1));
	},
	dataBrowser: [
		{ string: navigator.userAgent, subString: "Chrome", identity: "Chrome" },
		{ string: navigator.vendor, subString: "Apple", identity: "Safari", versionSearch: "Version" },
		{ string: navigator.userAgent, subString: "Firefox", identity: "Firefox" },
		{ string: navigator.userAgent, subString: "MSIE", identity: "Explorer", versionSearch: "MSIE" }
	],
	dataOS : [
		{ string: navigator.platform, subString: "Win", identity: "Windows" },
		{ string: navigator.platform, subString: "Mac", identity: "Mac"},
		{ string: navigator.userAgent, subString: "iPhone", identity: "iPhone/iPod" },
		{ string: navigator.platform, subString: "Linux", identity: "Linux" }
	]
};
BrowserDetect.init();

if (BrowserDetect.browser == MSIE && BrowserDetect.version < 9)
	window.location = window.location.protocol + "//" + window.location.hostname + "/compatible"

(function(scope) {
	var PB = {
		hasTouch: function() {
			return 'ontouchstart' in window;
		},
		get isSmallScreen() {
		  return window.matchMedia("(max-width: 650px)").matches;
		},
		get isSmallHost() {
			return window.location.hostname.match(/^touch/) !== null;
		},
		// redirects to small or large site
		redirectToProperHost: function() {
			var wantSmallHost = PB.isSmallScreen();
			var hasSmallHost = window.location.hostname.match(/^touch/) !== null;
			if (wantSmallHost != hasSmallHost) {
				var isDev = window.location.hostname.match(/dev/);
				var desiredHost = wantSmallHost ? ( isDev ? 'touchdev.pb4us.com' : 'touch.pb4us.com')
															: (isDev ? 'dev.pb4us.com' : 'www.pb4us.com');
				var url = window.location.protocol + '//' + desiredHost;
				url +=  window.location.port != "" ? ':' + window.location.port : '';
				url += window.location.pathname;
				alert('want ' + url);
				window.location.replace(url);
			}
		},
		_makeAlertDiv: function(text, klass) {
			return $('<div class="alert ' + klass + '">' +
				'<button class="close" data-dismiss="alert">×</button>'
				+ text + '</div>');
		},
		_getAlertContainer: function() {
			var c = $('#alert-container');
			if (c.length === 0)
				$('body').append("<div id='alert-container'/>");
			return $('#alert-container');
		},
		info: function(text) {
			var newDiv = this._makeAlertDiv(text, 'alert-info');
			this._getAlertContainer().append(newDiv);
			return newDiv;
		},
		warn: function(text) {
			var newDiv = this._makeAlertDiv(text, 'alert-warning');
			this._getAlertContainer().append(newDiv);
			return newDiv;
		},
		error: function(text) {
			var newDiv = this._makeAlertDiv(text, 'alert-error');
			this._getAlertContainer().append(newDiv);
			return newDiv;
		},
		debugstr: function() {
			console.error.apply(console, arguments);
			debugger;
		},
		// shows flash messages from xhr headers
		showXhrFlash: function(event, jqXHR, ajaxOptions) {
			var msg = jqXHR.getResponseHeader('X-FlashError');
			if (msg) PB.error(msg);
			msg = jqXHR.getResponseHeader('X-FlashNotice');
			if (msg) PB.info(msg);
		},
		stopEvent: function(ev) {
			ev.stopPropagation();
			ev.preventDefault();
		}
	};
	// Timer utility class
	var Timer = function(name, ignoreUnder) {
		this.startMili = Date.now();
		this.endMili = this.startMili;
		this.name = name;
		this.ignoreUnder = ignoreUnder || 100;
		this.start();
	};

	Timer.prototype = {
		start: function() {
			this.startMili = Date.now();
			return this;
		},
		print: function(msg) {
			this.endMili = Date.now();
			var total = this.endMili - this.startMili;
			console.log(this.name, msg || "", total + " ms");
		}
	};
	PB.Timer = Timer;

	if (!('PB' in scope)) scope.PB = {};
	$.extend(scope.PB, PB);

	$(document).ready(function() {
		$(document).ajaxComplete(PB.showXhrFlash);
	});

})(window);
