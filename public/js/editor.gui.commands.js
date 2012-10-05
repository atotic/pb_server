// editor.gui.commands.js

// CommandManager and Command
(function(scope) {
	var Command = function(name, key, meta, callback) {
		this.name = name;
		this.key = key;
		this.meta = meta;
		this.callback = callback;
	};

	scope.Command = Command;

})(window.GUI);

(function(scope) {
	var CommandManager = {
		commandSets: [],
		init: function() {

			$(document).keydown( function(ev) {
				ev = ev.originalEvent;
				if (ev.repeat)
					return;
				var s = CommandManager.eventToString(ev);
				for (var i=CommandManager.commandSets.length-1; i >=0; i--) {
					var cmd = CommandManager.commandSets[i].getCommand(s);
					if (cmd) {
						cmd.callback();
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
			rightArrow: '→'
		},
		// see http://unixpapa.com/js/key.html for the madness that is js key handling
		// 2012: most browsers not supporting html5 keyboard event specs
		eventToString: function(ev) {
			if (ev.repeat)
				return null;
			var key = null;	// key as string
			if ('keyIdentifier' in ev) {
				switch(ev.keyIdentifier) {
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
					case 27:
						key = this.keys.esc; break;
					case 109: // Chrome
					case 173: // FF
						key = this.keys.minus; break;
					case 107: // Chrome
					case 61: // FF
						key = this.keys.plus; break;
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
			console.log("shortcut", s);
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
	var CommandSet = function(name) {
		this.name = name;
		this._shortcuts = {};	// hash of shortcuts, key-combo: cmd
		this._commands = {}; // name: cmd
	}

	CommandSet.prototype = {
		add: function(cmd) {
			if (cmd.key)
				this._shortcuts[GUI.CommandManager.asciiToString(cmd.key, cmd.meta)] = cmd;
			if (cmd.name)
				this._commands[cmd.name] = cmd;
		},
		remove: function(cmd) {
			if (cmd.key) {
				var k = GUI.CommandManager.asciiToString(cmd.key, cmd.meta);
				if (k in this._shortcuts)
					delete this._shortcuts[k];
			}
			if (cmd.name && cmd.name in this._commands)
				delete this._commands[cmd.name];
		},
		getCommand: function(shortcut) {
			return this._shortcuts[shortcut];
		}
	}

	scope.CommandSet = CommandSet;
})(window.GUI);
