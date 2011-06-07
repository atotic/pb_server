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
			this.undoneQ = [];
			this.send('commandQueueChanged', this);
		}
	},
	
	undo: function() {
		if (this.completeQ.length > 0) {
			var cmd = this.completeQ.pop();
			if (cmd.canUndo()) {
				cmd.undo();
				this.undoneQ.push(cmd);
				this.send('commandQueueChanged', this);
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
				this.send('commandQueueChanged', this);
				return;
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

PB.Commands.Abstract = function() {
}
PB.Commands.Abstract.prototype = {
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
}

/* 
    Page CSS manipulation within command framework

Constructors:
	ModifyPageCSS(newCss, oldCss)
	newCss is an array of jQuery -> style:map
	oldCss is optional, just like newCss, but contains original values
   
Usage:
   cmd = new ModifyPageCSS([$("#el"), { position: 5px}]);

	 if command is to be executed once:
	 PB.CommandQueue.execute(cmd);

	 or, if cmd needs to be executed continuously:
	 cmd.redo();
	 cmd.setProps($("#el"), {position: 10px}).redo();
	 cmd.setProps($("#el"), {position: 15px}).redo();
	 PB.CommandQueue.push(cmd);
*/ 
PB.Commands.ModifyPageCSS = function(newCss, oldCss) {
	this.newCss = newCss;
	this.oldCss = oldCss;
	this.pageId = $(this.newCss[0].dom).parents(".page-enclosure").data("page_id");
}

PB.Commands.ModifyPageCSS.prototype = {
	canUndo: function() {
		return this.oldCss != null && PB.UI.Bookpage.getDomById(this.pageId) != null;
	},
	canRedo: function() {
		return this.newCss != null && PB.UI.Bookpage.getDomById(this.pageId) != null;
	},
	redo: function() {
		this.applyCss(this.newCss);
	},
	undo: function() {
		this.applyCss(this.oldCss);
	},
	setCss: function(newCss) {
		this.newCss = newCss;
		return this;
	},
	saveCss: function() {
		if (this.oldCss)
			return;
		this.oldCss = [];
		for (var i=0; i< this.newCss.length; i++) {
			var oldStyle = {};
			var dom = $(this.newCss[i].dom);
			for (var pname in this.newCss[i].style) {
				var pval = dom.css(pname);
				if (pval === undefined)
					pval = 'auto';
				oldStyle[pname] = pval;
			}
			this.oldCss.push({ dom: this.newProps[i].dom, style: oldStyle});
		}
	},
	applyCss: function(css) {
	 	if (css == null)
	 		return;
		this.saveCss();
		for (var i=0; i< css.length; i++)
			$(css[i].dom).css(css[i].style);
		this.setModified();
	},
	setModified: function() {
		PB.book().getPageById(this.pageId).setModified();
	}
}

PB.Manipulators = {
	
	createImageButton: function(kind, title, imageDiv, cursor) {
		var html = "<button class='image-button deleteme " + kind + "'>" + title + "</button>";
		var button = $(html).prependTo(imageDiv);
		var mouseCb = this[kind];
		this.bindButtonEvents(button, imageDiv, mouseCb, cursor);
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
	
	// 
	bindButtonEvents: function(button, imageDiv, mouseCb, cursor) {
		var docEvents = {
			processMouse: mouseCb,
			pageId: $(imageDiv).parents(".page-enclosure").data("page_id"),
			oldCss: null,
			newCss: null,
			setCss: function(newCss) {
				this.saveOldCss(newCss);
				this.newCss = newCss;
				for ( var i=0; i< newCss.length; i++ )
					$( newCss[i].dom ).css( newCss[i].style );
				PB.book().getPageById(this.pageId).setModified();
			},
			saveOldCss: function(newCss) {
				if (this.oldCss)
					return;
				this.oldCss = [];
				for (var i=0; i< newCss.length; i++) {
					var oldStyle = {};
					var dom = $(newCss[i].dom);
					for (var pname in newCss[i].style) {
						var pval = dom.css(pname);
						if (pval === undefined) pval = 'auto';
						oldStyle[pname] = pval;
					}
					this.oldCss.push({ dom: newCss[i].dom, style: oldStyle});
				}				
			},
			mousemove: function(ev) {
				var moveX = ev.pageX - docEvents.data.mouseStartX;
				var moveY = ev.pageY - docEvents.data.mouseStartY;
				docEvents.processMouse(moveX, moveY, ev);
			},
			mousedown: function(ev) {
				console.log("mousedownDoc");
				var cmd = new PB.Commands.ModifyPageCSS(docEvents.newCss, docEvents.oldCss);
				PB.CommandQueue.push(cmd);
				$("body").css("cursor", "auto");
				$(document).unbind("mousemove", docEvents.mousemove);
				$(document).unbind("mousedown", docEvents.mousedown);
			}
		};
		var buttonEvents = {
			mousedown: function(ev) {
				imageDiv.mouseleave();	// hides the buttons
				var image = imageDiv.find(".actual-image").get(0);
				docEvents.data = {
					mouseStartX: ev.pageX,
					mouseStartY:ev.pageY,
					image: $(image),
					imageTop: parseFloat(image.style.top),
					imageLeft: parseFloat(image.style.left),
					imageWidth: parseFloat(image.style.width),
					imageHeight: parseFloat(image.style.height),
					centerX: ev.pageX - 100, // BUG should be based upon center of the image
					centerY: ev.pageY,
					imageDiv: imageDiv,
					imageDivTop: parseFloat(imageDiv.css("top")),
					imageDivLeft: parseFloat(imageDiv.css("left")),
					imageDivWidth: parseFloat(imageDiv.css("width")),
					imageDivHeight: parseFloat(imageDiv.css("height")),
				};
				ev.preventDefault();
				ev.stopPropagation();
				$("body").css("cursor", cursor);
				$(document).bind(docEvents);
			}
		};
		button.bind(buttonEvents);		
	},

	pan: function (moveX, moveY, ev) {
		if (! ('transformMatrix' in this.data))
			this.data.transformMatrix = $.transformMatrix(this.data.imageDiv.css("transform"));
		var transX = this.data.transformMatrix[0] * moveX + this.data.transformMatrix[1] * moveY;
		var transY = this.data.transformMatrix[2] * moveX + this.data.transformMatrix[3] * moveY;
		var css = {
			top: (this.data.imageTop + transY) + "px",
			left: (this.data.imageLeft + transX) + "px"
		}
		this.setCss([{dom: this.data.image, style: css}]);
	},

	move: function (moveX, moveY, ev) {
		var css = {
			top: (this.data.imageDivTop + moveY) + "px",
			left: (this.data.imageDivLeft + moveX) + "px"
		}
		this.setCss([{dom: this.data.imageDiv, style: css}]);
	},

	zoom: function(moveX, moveY, ev) {
		var	top = this.data.imageTop + moveY;
		var	height = this.data.imageHeight - moveY * 2;
		var	xdelta = moveY * this.data.imageWidth / this.data.imageHeight;
		var	left = this.data.imageLeft + xdelta;
		var	width = this.data.imageWidth - xdelta * 2;
		var css = {
			top: top + "px",
			left: left + "px",
			height: height + "px",
			width: width + "px"
		}
		this.setCss([{dom: this.data.image, style: css}]);
	},

	rotate: function(moveX, moveY, ev) {
		// Rotate
		// compute angle, pythagora
		if (! ('oldRotation' in this.data)) {
			this.data.oldRotation = $.transformUnmatrix($.transformMatrix(this.data.imageDiv.css("transform"))).rotate;
		}
		var b = this.data.centerY - ev.pageY;
		var a = ev.pageX - this.data.centerX;
//		console.log("Y:" +b + " X:" + a);
		var c = Math.sqrt(a*a+b*b);
		var angle = Math.asin(b / c);
		if (a < 0)
			angle = Math.PI / 2 + ( Math.PI / 2 - angle);
		angle = -angle;
//		console.log("angle is " + ( 360 * angle / 2 / Math.PI));
		angle += this.data.oldRotation;
		var css = {
			transform: "rotate(" + angle + "rad)"
		}
		this.setCss([{dom: this.data.imageDiv, style: css}]);
	}
}