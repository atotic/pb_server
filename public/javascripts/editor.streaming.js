"use strict"

//
// Permanent connection to server.
//
/* Design notes:
	- server keeps a list of all ServerCmds. Each command has an unique, increasing id, 
	- document saved on server "matches" the command stream saved on server. 
		Matches means document state is the product of all server commands being applied
	- each client can modify server document only if it is up-to-date with server commands
	- if client is not up-to-date, it must process all server commands before proceeding
	- client keeps track of last_cmd_id, which is the last command executed on the book
	
	
	
*/ 
PB.ServerStream = {

	_init: $(document).ready(function() { PB.ServerStream.init() }),
	init: function () {
		// send last command id with every ajax request
		$('body').ajaxSend(function(event, jsXHR, ajaxOptions) {
			var book = PB.book();
			if (book == null)
				return;
			ajaxOptions.headers = ajaxOptions.headers || {};
			jsXHR.setRequestHeader('X-SvegStream', book.stream_id + ";" + book.id);
			jsXHR.setRequestHeader('X-Sveg-LastCommandId', book.last_server_cmd_id);
		});
	},

	url: function(book) {
		return "/cmd/stream/" + book.id + "?last_cmd_id=" + (book ? book.last_server_cmd_id : 0);
	},
	
	connect: function(book) {
		var stream = $.stream(this.url(book), {
			context: this,
			dataType: 'json',
			type: 'http',
			reconnect: false,	// we'll handle reconnect
			handleSend: function() { // no talking back to the server 
				return false; 
			}, 
			// Lifecycle callbacks
			open: function(event, stream) {
			},
			message: function(ev) {
				PB.ServerCmd.create(ev.data);
			},
			error: function(ev) {
				console.log("ServerStream error , possible closure");
			},
			close: function(ev) {
				PB.warn("server connection closed");
				book.stream = null;
			}
		});
		return stream;
	}
}

/*
 * ServerCmd are commands broadcasted by the server
 * json is of the form:
 * { id: command_id, type: command_type, book_id: book.id, payload: {  command_specific_stuff }
 */
PB.ServerCmd = {
	create: function (json) {
		if (!('type' in json)) {
			console.error("Malformed server command " + json);
			return;
		}
		else
			console.log("Processing server cmd " + json.type);
		var cmd;
		switch(json.type) {
			case "AddPhoto":
				cmd = new PB.ServerCmd.AddPhoto(json); break;
			case "StreamUpToDate":
				cmd = new PB.ServerCmd.StreamUpToDate(json); break;
			default:
				throw "Unknown server command";
		};
		try {
			cmd.doIt();
			if (cmd.cmd_id)
				PB.book().last_server_cmd_id = cmd.cmd_id;
		}
		catch(e) {
			console.error("Error ServerCmd: " + e);
			console.error(json);
		}
	}
}

// AddPhoto adds photo to the document
PB.ServerCmd.AddPhoto = function(json) {
	this.initServerCmd(json);
}

PB.ServerCmd.AddPhoto.prototype = {
	initServerCmd: function(json) {
		this.cmd_id = json.id;
		this.book_id = json.book_id;
		this.payload = json.payload;
	},
	doIt: function() {
		var photo = new PB.PhotoBroker(this.payload);
		var book = PB.book();
		if (book.id != this.book_id)
			throw "Book id mismatch in ServerCmd.doIt";
		// Only add image if it does not exist
		if (!book.getPhotoById(photo.id))
			book.addPhoto(photo);
	}
};

// StreamUpToDate broadcasts serverStreamUpToDate event
PB.ServerCmd.StreamUpToDate = function(json) {
	this.book_id = json.book_id;
}

PB.ServerCmd.StreamUpToDate.prototype = {
	doIt: function() {
		var book = PB.book();
		if (book.id != this.book_id)
			throw "Book id mismatch in ServerCmd.doIt";
		book.send("serverStreamUpToDate", book);
	}
	
}