(function(scope) {
	var PB = {
		hasTouch: function() {
			return 'ontouchstart' in window;
		},
		isSmallScreen: function() {
		  return window.matchMedia("(max-width: 650px)").matches;
		},
		// redirects to touch or wimp site
		redirectToProperHost: function() {
			var hasTouch = PB.hasTouch();
			var isSmallScreen = PB.isSmallScreen();
			var wantSmallHost = hasTouch && isSmallScreen;
			var hasSmallHost = window.location.hostname.match(/^touch/) != null;
//			alert("wantSmallHost " + wantSmallHost + " hasSmallHost " + hasSmallHost);
			if (wantSmallHost != hasSmallHost) {
				var isDev = window.location.hostname.match(/dev/);
				var desiredHost = wantSmallHost ? ( isDev ? 'touchdev.pb4us.com' : 'touch.pb4us.com')
															: (isDev ? 'dev.pb4us.com' : 'www.pb4us.com');
				alert("currentPath " + window.location.pathname);
				var url = window.location.protocol + '//' + desiredHost
								+ (window.location.port != "" ? ':' + window.location.port : '')
								+ window.location.pathname;
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
			if (c.length == 0)
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
		// shows flash messages from xhr headers
		showXhrFlash: function(event, jqXHR, ajaxOptions) {
			var msg = jqXHR.getResponseHeader('X-FlashError');
			if (msg) PB.error(msg);
			var msg = jqXHR.getResponseHeader('X-FlashNotice');
			if (msg) PB.info(msg);
		}
	}
	PB.redirectToProperHost();

	if (!('PB' in scope)) scope.PB = {};
	$.extend(scope.PB, PB);

	$(document).ready(function() {
		$(document).ajaxComplete(PB.showXhrFlash);
	});

})(window);
