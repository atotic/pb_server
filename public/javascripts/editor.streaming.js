"use strict"

PB.ServerStream = {
	_init: $(document).ready(function() { PB.ServerStream.init() }),

	init: function () {
		this.connect();
	},
	// cmd stream has an id
	get id() {
		if ('_id' in this)
			return this._id;
		else {
			this._id = "";
			for (var i=0;  i<6; i++)
				this._id += String.fromCharCode(65 + Math.random() * 26);
		}
		return this._id;
	},
	
	get url() {
		return "http://" + window.location.host + "/cmd/stream/" + this.id;
	},
	
	connect: function() {
		$.stream(this.url, {
			close: function(ev) {
				PB.warn("server connection closed");
			},
			context: this,
			dataType: 'json',
			error: function(ev) {
				alert("ServerStream error");
				debugger;
			},
			message: function(ev) {
				console.log("got event");
				console.log(ev);
				debugger;
			},
			reconnect: false	// we'll handle reconnect
		});
	}
}