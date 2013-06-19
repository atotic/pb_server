// editor.gui.commands.js

// CommandManager and Command
(function(scope) {
	var Command = function(options) {
		this.id = options.id;
		this.meta = options.meta;
		this.action = options.action;	// callback
		this.title = options.title;
		this.icon = options.icon;
		if ( 'key' in options ) {
			if ('string' === typeof options.key)
				this.key = [options.key];
			else
				this.key = options.key;
		}
	};

	scope.Command = Command;

})(window.GUI);

// CommandManager
(function(scope) {
	var CommandManager = {
		commandSets: [],
		init: function() {

			$(document).on('keydown', function(ev) {
				ev = ev.originalEvent;
				if (ev.repeat)
					return;
				var s = CommandManager.eventToString(ev);
				for (var i=CommandManager.commandSets.length-1; i >=0; i--) {
					var cmd = CommandManager.commandSets[i].getCommandFromShortcut(s);
					if (cmd) {
						cmd.action();
						break;
					}
				}
			});
		},
		keys: {	// all the keys we recognize are listed here
			esc: "esc",
			plus: "+",
			minus: "-",
			meta: "meta-",
			leftArrow: '←',
			rightArrow: '→',
			backspace: 'back'
		},
		// see http://unixpapa.com/js/key.html for the madness that is js key handling
		// 2012: most browsers not supporting html5 keyboard event specs
		eventToString: function(ev) {
			if (ev.repeat)
				return null;
			var key = null;	// key as string

			function handleDelete() {
				if (ev.target.nodeName == 'BODY') {
						// otherwise textarea edits trigger deletes
						key = CommandManager.keys.backspace;
						ev.preventDefault();
					}
			}
			if ('keyIdentifier' in ev) {
				switch(ev.keyIdentifier) {
					case "U+0008":
						handleDelete();
						break;
					case "U+001B":
						key = this.keys.esc; break;
					case "Left":
						key = this.keys.leftArrow; break;
					case "Right":
						key = this.keys.rightArrow; break;
					default:
						var keyCode = parseInt(ev.keyIdentifier.replace(/U\+/, ""), 16);
						if (keyCode)
							key = String.fromCharCode(keyCode);
						break;
				}
			}
			else if ('keyCode' in ev) {
				switch (ev.keyCode) {
					case 8:
						handleDelete();
						break;
					case 27:
						key = this.keys.esc; break;
					case 109: // Chrome
					case 173: // FF
						key = this.keys.minus; break;
					case 107: // Chrome
					case 61: // FF
						key = this.keys.plus; break;
					case 37: // FF
						key = this.keys.leftArrow; break;
					case 39: // FF
						key = this.keys.rightArrow; break;
					default:
						;
				}
			}
			else {
				console.warn("keyboard event without keyIdentifer or keyCode");
			}
			if (!key || key == "" || (key.length > 0 && key.charCodeAt(0) < 32))
				return null;
			var s = ev.altKey ? this.keys.meta : '';
			s += key.toLowerCase();
			//			console.log("meta", ev.metaKey, "ctrl", ev.ctrlKey, "altKey", ev.altKey);
			//			console.log("shortcut", s);
			return s;
		},
		asciiToString: function(key, meta) {
			var s = meta ? this.keys.meta : '';
			s += key.toLowerCase();
			return s;
		},
		addCommandSet: function(set) {
			var idx = this.commandSets.indexOf(set);
			if (idx == -1)
				this.commandSets.push(set);
		},
		removeCommandSet: function(set) {
			var idx = this.commandSets.indexOf(set);
			if (idx != -1)
				this.commandSets.splice(idx, 1);
		}
	}
	scope.CommandManager = CommandManager;

})(window.GUI);

(function(scope) {
	var CommandSet = function(id) {
		this.id = name;
		this._shortcuts = {};	// hash of shortcuts, key-combo: cmd
		this._commands = {}; // id: cmd
	}

	CommandSet.prototype = {
		add: function(cmd) {
			if (cmd.key)
				for (var i=0; i<cmd.key.length; i++) {
					var shortcut = GUI.CommandManager.asciiToString( cmd.key[i], cmd.meta );
					this._shortcuts[ shortcut ] =  cmd;
				}
			if (cmd.id)
				this._commands[cmd.id] = cmd;
		},
		remove: function(cmd) {
			if (cmd.key)
				for (var i=0; i<cmd.key.length; i++) {
					var k = GUI.CommandManager.asciiToString(cmd.key[i], cmd.meta);
					if (k in this._shortcuts)
						delete this._shortcuts[k];
				}
			if (cmd.id && cmd.id in this._commands)
				delete this._commands[cmd.id];
		},
		activate: function() {
			GUI.CommandManager.addCommandSet( this );
		},
		deactivate: function() {
			GUI.CommandManager.removeCommandSet( this );
		},
		getCommandFromShortcut: function(shortcut) {
			return this._shortcuts[shortcut];
		},
		getCommandById: function(id) {
			return this._commands[id];
		},
		getCommands: function() {
			var retVal = [];
			for (x in this._commands)
				retVal.push(this._commands[x]);
			return retVal;
		}
	}

	scope.CommandSet = CommandSet;
})(window.GUI);
