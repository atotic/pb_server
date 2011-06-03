/*
 * Standard Command Pattern
 * 
 * PB.CommandQueue keeps list of PB.Command , manages undo redo
 * 
 * 
 */
PB.CommandQueue = {

	completeQ: [],	// Already executed commands
	undoneQ: [], // Commands that have been undone
	
	// Execute command, and push it onto the queue
	execute: function(command) {
		command.redo();
		if (command.canUndo()) {
			this.completeQ.push(command);
			this.send('commandQueueChanged', this);
		}
	},
	
	// Push a command onto the queue, if 
	push: function(command) {
		if (command.canUndo()) {
			this.completeQ.push(command);
			this.send('commandQueueChanged', this);
		}
	},
	
	undo: function() {
		if (this.completeQ.length > 0) {
			var cmd = this.completeQ.pop();
			if (cmd.canUndo()) {
				cmd.undo();
				this.undoneQ.push(cmd);
				return;
			}
		}
		PB.warn("Can't undo");
	},
	
	redo: function() {
		if (this.undoneQ.length > 0) {
			var cmd = this.undoneQ.pop();
			if (cmd.canRedo()) {
				cmd.redo();
				this.completeQ.push(cmd);
			}
		}
		PB.warn("Can't redo");
	},
	refresh: function() {
		var changed = false;
		if (this.completeQ.length > 0 
			&& !this.completeQ[ this.completeQ.length-1 ].canUndo())  {
				// Last command cannot be undone any more
				this.completeQ = [];
				changed = true;
			}
		if (this.undoneQ.length > 0 
			&& !this.undoneQ[ this.undoneQ.length-1 ].canRedo()) {
				// Undone command cannot be redone any more
				this.undoneQ = [];
				changed = true;
			}
		if (changed)
			this.send('commandQueueChanged', this);
	},
	
	canRedo: function() {
		this.refresh();
		return this.undoneQ.length > 0;
	},
	
	canUndo: function() {
		this.refresh();
		return this.completeQ.length > 0;
	}
}
$.extend(PB.CommandQueue, new PB.EventBroadcaster("commandQueueChanged"));

PB.Commands = {};

PB.Commands.Abstract = Class.extend({
	init: function(name) {
		this.name = name;
	},
	canUndo: function() {
		alert("implement me");
	},
	canRedo: function() {
		alert("implement me");
	},
	redo: function() {
		alert("need to implement redo");
	},
	undo: function() {
		alert("need to implement redo");
	}
});

/* 
    Page CSS manipulation within command framework

Constructors:
   ModifyPageCSS(name, jQuery, style:map)
   ModifyPageCSS(name, [ {jQuery , style:map }+)
   
Usage:
   cmd = new ModifyPageCSS("name", $("#el"), { position: 5px});

	 if command is to be executed once:
	 PB.CommandQueue.execute(cmd);

	 or, if cmd needs to be executed continuously:
	 cmd.redo();
	 cmd.setProps($("#el"), {position: 10px}).redo();
	 cmd.setProps($("#el"), {position: 15px}).redo();
	 PB.CommandQueue.push(cmd);
*/ 
PB.Commands.ModifyPageCSS = PB.Commands.Abstract.extend({
	init: function(name) {
		this._super(name);
		if (arguments.length == 3)
			this.setProps(arguments[1], arguments[2]);
		else if (arguments.length == 2)
			this.setProps(arguments[1]);
		else
			console.error("ModifyPageCSS called with wrong number of arguments");
		this.pageId = $(this.newProps[0].dom).parents(".page-enclosure").data("page_id");
	},
	canUndo: function() {
		return this.oldProps != null && PB.UI.Bookpage.getDomById(this.pageId) != null;
	},
	canRedo: function() {
		return this.newProps != null && PB.UI.Bookpage.getDomById(this.pageId) != null;
	},
	redo: function() {
		this.applyProps(this.newProps);
	},
	undo: function() {
		this.applyProps(this.oldProps);
	},
	setProps: function() {
		if (arguments.length == 2)
			this.newProps = [ { dom: arguments[0], style: arguments[1]} ];
		else
			this.newProps= arguments[0];
		return this;
	},
	saveOldProps: function() {
		if (this.oldProps)
			return;
		this.oldProps = [];
		for (var i=0; i< this.newProps.length; i++) {
			var oldStyle = {};
			var dom = $(this.newProps[i].dom);
			for (var pname in this.newProps[i].style) {
				var pval = dom.css(pname);
				if (pval === undefined)
					pval = 'auto';
			//	oldStyle[pname] = pval;
			}
			this.oldProps.push({ dom: this.newProps[i].dom, style: oldStyle});
		}
	},
	applyProps: function(props) {
	 	if (props == null)
	 		return;
		this.saveOldProps();
		for (var i=0; i< props.length; i++)
			$(props[i].dom).css(props[i].style);
		this.setModified();
	},
	setModified: function() {
		PB.book().getPageById(this.pageId).setModified();
	}
});

PB.Commands.AbstractImage = PB.Commands.ModifyPageCSS.extend({ 
	init: function(name, imageDiv) {
		this._super(name, imageDiv, {});
	},
	complete: function() {
		PB.CommandQueue.push(this);
	}	
});

PB.Commands.PanImage =  PB.Commands.AbstractImage.extend({
	init: function(imageDiv) {
		this._super("pan", imageDiv);
	},
	processMouse: function(data, moveX, moveY, ev) {
		var css = {
			top: (data.imageTop + moveY) + "px",
			left: (data.imageLeft + moveX) + "px"
		}
		this.setProps(data.image, css).redo();
	}
});

PB.Commands.MoveImage =  PB.Commands.AbstractImage.extend({
	init: function(imageDiv) {
	 this._super("move", imageDiv);
	},
	processMouse: function(data, moveX, moveY, ev) {
		var css = {
			top: (data.imageDivTop + moveY) + "px",
			left: (data.imageDivLeft + moveX) + "px"
		}
		this.setProps(data.imageDiv, css).redo();
	}
});

PB.Commands.ZoomImage =  PB.Commands.AbstractImage.extend({
	init: function(imageDiv) {
		this._super("zoom", imageDiv);
	},
	processMouse: function(data, moveX, moveY, ev) {
		var	top = data.imageTop + moveY;
		var	height = data.imageHeight - moveY * 2;
		var	xdelta = moveY * data.imageWidth / data.imageHeight;
		var	left = data.imageLeft + xdelta;
		var	width = data.imageWidth - xdelta * 2;	
		var css = {
			top: top + "px",
			left: left + "px",
			height: height + "px",
			width: width + "px"
		}
		this.setProps(data.image, css).redo();
	}
});

PB.Commands.RotateImage =  PB.Commands.AbstractImage.extend({
	init: function(imageDiv) {
		this._super("zoom", imageDiv);
	},
	processMouse: function(data, moveX, moveY, ev) {
		// Rotate
		// compute angle, pythagora
		var b = data.centerY - ev.pageY;
		var a = ev.pageX - data.centerX;
		var c = Math.sqrt(a*a+b*b);
		var angle = Math.asin(b / c);
		if (a < 0)
			angle = Math.PI / 2 + ( Math.PI / 2 - angle);
		angle = -angle;
		// TODO constrain angle if shift is down
		var css = {
			transform: "rotate(" + angle + "rad)"
		}
		this.setProps(data.imageDiv, css).redo();
	}
});

PB.Manipulators = {
	
	createImageButton: function(kind, title, imageDiv) {
		var html = "<button class='image-button deleteme " + kind + "'>" + title + "</button>";
		var button = $(html).prependTo(imageDiv);
		var cmd = null;
		switch(kind) {
			case "move": cmd = new PB.Commands.MoveImage(imageDiv); break;
			case "pan": cmd = new PB.Commands.PanImage(imageDiv); break;
			case "zoom": cmd = new PB.Commands.ZoomImage(imageDiv); break;
			case "rotate": cmd = new PB.Commands.RotateImage(imageDiv); break;
			default: console.error("unknown button kind " + kind);
		}
		this.bindButtonEvents(button, imageDiv, cmd);
	},

	bindButtonEvents: function(button, imageDiv, cmd) {
		var docEvents = {
			cmd: cmd, 
			mousemove: function(ev) {
				var moveX = ev.pageX - docEvents.data.mouseStartX;
				var moveY = ev.pageY - docEvents.data.mouseStartY;
				docEvents.cmd.processMouse(docEvents.data, moveX, moveY, ev);
			},
			mouseup: function(ev) {
				console.log("mouseup");
				docEvents.cmd.complete();
				$(document).unbind("mousemove", docEvents.mousemove);
				$(document).unbind("mouseup", docEvents.mouseup);
			}
		};
		var buttonEvents = {
			mousedown: function(ev) {
				imageDiv.mouseleave();	// hides the buttons
				var image = imageDiv.find(".actual-image").get(0);
				var originalAngle = 0;
				var transform = imageDiv.css("transform");
				if (transform) {
					var match = transform.match(/.*rotate\(([^)]+)\)/);
					if (match && match.length == 1)
						originalAngle = parseFloat(match[1]) || 0;
				}
				docEvents.data = {
					mouseStartX: ev.pageX,
					mouseStartY:ev.pageY,
					image: $(image),
					imageTop: parseFloat(image.style.top),
					imageLeft: parseFloat(image.style.left),
					imageWidth: parseFloat(image.style.width),
					imageHeight: parseFloat(image.style.height),
					centerX: ev.pageX - 50, // BUG should be based upon center of the image
					centerY: ev.pageY,
					originalAngle: originalAngle,
					imageDiv: imageDiv,
					imageDivTop: parseFloat(imageDiv.css("top")),
					imageDivLeft: parseFloat(imageDiv.css("left")),
					imageDivWidth: parseFloat(imageDiv.css("width")),
					imageDivHeight: parseFloat(imageDiv.css("height"))
				};
				ev.preventDefault();
				$(document).bind(docEvents);
			}
		};
		button.bind(buttonEvents);		
	},

	pan: function (moveX, moveY, ev) {
		this.data.image.css("top",(this.data.imageTop + moveY) + "px");
		this.data.image.css("left",(this.data.imageLeft + moveX) + "px");
	},

	move: function (moveX, moveY, ev) {
		this.data.imageDiv.css("top", (this.data.imageDivTop + moveY) + "px");
		this.data.imageDiv.css("left", (this.data.imageDivLeft + moveX) + "px");
	},

	zoom: function(moveX, moveY, ev) {
		var	top = this.data.imageTop + moveY;
		var	height = this.data.imageHeight - moveY * 2;
		var	xdelta = moveY * this.data.imageWidth / this.data.imageHeight;
		var	left = this.data.imageLeft + xdelta;
		var	width = this.data.imageWidth - xdelta * 2;
			this.data.image.css({
					top: top + "px",
					left: left + "px",
					height: height + "px",
					width: width + "px"
			});
	},

	rotate: function(moveX, moveY, ev) {
		// Rotate
		// compute angle, pythagora
		var b = this.data.centerY - ev.pageY;
		var a = ev.pageX - this.data.centerX;
		var c = Math.sqrt(a*a+b*b);
		var angle = Math.asin(b / c);
		if (a < 0)
			angle = Math.PI / 2 + ( Math.PI / 2 - angle);
		angle = -angle;
		this.data.imageDiv.css("transform", "rotate(" + angle + "rad)");
	}
}