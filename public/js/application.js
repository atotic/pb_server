var PB = {
	// True if we are on touch device
	detectTouch: function() {
		return 'ontouchstart' in window;
	},
	// redirects to touch or wimp site
	redirectToProperHost: function() {
		var hasTouch = PB.detectTouch();
		var hasTouchHost = window.location.hostname.match(/^touch/) != null;
		if (hasTouch != hasTouchHost) {
			var isDev = window.location.hostname.match(/dev/);
			var desiredHost = hasTouch ? ( isDev ? 'touchdev.pb4us.com' : 'touch.pb4us.com') 
														: (isDev ? 'dev.pb4us.com' : 'www.pb4us.com');
			var url = window.location.protocol + '//' + desiredHost 
							+ (window.location.port != "" ? ':' + window.location.port : '')
							+ window.location.pathname;
			//alert('want ' + url);
			window.location.replace(url);
		}
	},
	notice: function(text) {
//		$('#error').hide();
		$('#notice').html(text).clearQueue().show('blind');
	},
	warn: function(text) {
		this.notice(text);
	},
	error: function(text) {
//		$('#notice').hide();
		$('#error').html(text).clearQueue().show('blind');
	},
	// Creates a new bar, or returns existing
	getMessageBar: function(bar_id) {
		var bar = $('#messages #' + bar_id);
		if (bar.length > 0) 
			return bar.get(0);
		bar = $("<div id='" + bar_id + "'></div>");
		bar.addClass("generic_notice").appendTo($("#messages"));
		return bar.get(0);
	},
	// shows flash messages from xhr headers
	showXhrFlash: function(event, jqXHR, ajaxOptions) {
		var msg = jqXHR.getResponseHeader('X-FlashError');
		if (msg) PB.error(msg);
		var msg = jqXHR.getResponseHeader('X-FlashNotice');
		if (msg) PB.notice(msg);
	},
	// progress(val) -- show val
	// progress(mgs) -- show msg
	// progress(val, msg) -- show val, msg
	// progress()	-- hide the bar
	progress: function(/* optional val:integer msg:text */) {
		var val = null;
		var msg = null;
		switch(arguments.length) {
			case 0:
				$("#progress").hide();
				return;
			case 1:
				if (typeof arguments[0] == "number")
					val = arguments[0];
				else
					msg = arguments[0];
				break;
			case 2:
				val = arguments[0];
				msg = arguments[1];
				break;
			default:
				console.error("wrong number of arguments to progress");
				break;
		};
		if (val != null)
			$('#progress_bar').progressbar('value', val);
		if (msg != null)
			$('#progress_message').html(msg);
	},
	// options: show:boolean, max:integer (-1 indeterminate), message:string, interrupt: function cb
	progressSetup: function(options) {
		var opts = $.extend({
			show: true,
			value: 0,
			max: 100,
			message: null,
			cancelCb: null	// callback function
		}, options);
		$('#progress_bar').progressbar({value: opts.value, max: opts.max});
		if (opts.message != null)
			$('#progress_message').html(opts.message);
		if (opts.cancelCb)
			$('#progress_cancel').unbind().click(opts.cancelCb).show();
		else
			$('#progress_cancel').hide();
		if (opts.show)
			$('#progress').show();
		else
			$('#progress').hide();
	}
};

$(document).ready(function() {
	$(document).ajaxComplete(PB.showXhrFlash);
	$("#error, #notice").click(function(ev) {
		// handle clicking on the close box
		if (ev.pageX - $(ev.currentTarget).offset().left > (ev.currentTarget.offsetWidth - 35))
			$(ev.currentTarget).hide();
	});
});

