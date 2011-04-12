var PB = {
	fn: {},

	notice: function(text) {
//		$('#error').hide();
		$('#notice').html(text).clearQueue().show('blind');
	},

	error: function(text) {
//		$('#notice').hide();
		$('#error').html(text).clearQueue().show('blind');
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
	$("#error, #notice").click(function(ev) {
		// handle clicking on the close box
		if (ev.pageX - $(ev.currentTarget).offset().left > (ev.currentTarget.offsetWidth - 35))
			$(ev.currentTarget).hide();
	});
});

