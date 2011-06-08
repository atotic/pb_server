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
			this.trim();
			this.send('commandQueueChanged', this);
		}
		console.log("execute" + this);
	},
	
	// Push a command onto the queue, if 
	push: function(command) {
		if (command.canUndo()) {
			this.completeQ.push(command);
			this.undoneQ = [];
			this.trim();
			this.send('commandQueueChanged', this);
		}
		console.log("push" + this);
	},
	
	trim: function() {
		while (this.completeQ.length > 20)
			this.completeQ.shift();
	},
	
	undo: function() {
		if (this.completeQ.length > 0) {
			var cmd = this.completeQ.pop();
			if (cmd.canUndo()) {
				cmd.undo();
				this.undoneQ.push(cmd);
				this.send('commandQueueChanged', this);
				console.log("undo" + this);
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
				console.log("redo" + this);
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
	},
	toStringQueue: function(q) {
		var s = "";
		q.forEach(function(el) {
			s += el + "\n";
		});
		return s;
	},
	toString: function() {
		var s = "CommandQueue:\nComplete:\n" + this.toStringQueue(this.completeQ);
		s += "Undone:\n" + this.toStringQueue(this.undoneQ);
		return s;
	}
}
$.extend(PB.CommandQueue, new PB.EventBroadcaster("commandQueueChanged"));

PB.Commands = {};

// All commands should support this API
PB.Commands.prototype = {
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

PB.Commands.DropImage = function(pageId, imageBroker, imageDiv) {
	PB.guaranteeId(imageDiv);
	this.imageBroker = imageBroker;
	this.imageDivId = $(imageDiv).attr("id");
	this.pageId = pageId;
}

PB.Commands.DropImage.prototype = {
	canUndo: function() {
		return 'oldImg' in this;
	},
	canRedo: function() {
		return true;
	},
	redo: function() {
		// Load in the dom
		var page = PB.book().getPageById(this.pageId);
		var dom = $(page.getDom());
		var imageDiv = dom.find("#" + this.imageDivId);
		// Save for redo
		this.oldImg = dom.find("img");
		// Create the image
		var image = $('<img class="actual-image" style="visibility:hidden"/>');
	  image.bind("load",  function(ev) {
				PB.UI.Bookpage.imageLoaded(imageDiv);
				image.css("visibility", "visible");
		});
		imageDiv.empty().append(image);
		page.setModified();
		image.attr('src', this.imageBroker.getImageUrl('display'));
	},
	undo: function() {
		// Load in the dom
		var page = PB.book().getPageById(this.pageId);
		var dom = $(page.getDom());
		var imageDiv = dom.find("#" + this.imageDivId);
		// Set the old image
		imageDiv.empty().append(this.oldImg);
		PB.UI.Bookpage.imageLoaded(imageDiv);
		page.setModified();
		delete this.oldImg;
	},
	toString: function() {
		return "dropImage:" + imageBroker;
	}
}
/* 
    Page CSS manipulation within command framework

Constructors:
	ModifyPageCSS(newCss, oldCss)
	newCss is an array of selector -> style:map
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
PB.Commands.ModifyPageCSS = function(pageId, newCss, oldCss) {
	// deep copy incoming styles
	newCss = newCss.slice(0);
	for (var i=0; i< newCss.length; i++) { 
		var dom = $(newCss[i].dom);	// convert dom elements to ids
		PB.guaranteeId(dom);
		newCss[i] = {dom: "#" + dom.prop('id'), style: jQuery.extend({}, newCss[i].style)};
		newCss[i].dom = "#" + dom.prop('id');
	}
	if (oldCss) {
			oldCss = oldCss.slice(0);
			for (var i=0; i< oldCss.length; i++) {
				var dom = $(oldCss[i].dom);
				PB.guaranteeId(dom);
				oldCss[i] = {dom: "#" + dom.prop('id'), style: jQuery.extend({}, oldCss[i].style)} ;
			}
	}
	this.newCss = newCss;
	this.oldCss = oldCss;
	this.pageId = pageId;
	this.animate = true;
}

PB.Commands.ModifyPageCSS.prototype = {
	canUndo: function() {
		return this.oldCss != null;
	},
	canRedo: function() {
		return this.newCss != null;
	},
	redo: function() {
		this.applyCss(this.newCss);
	},
	undo: function() {
		this.applyCss(this.oldCss, true);
	},
	saveCss: function(page) {
		if (this.oldCss)
			return;
		this.oldCss = [];
		for (var i=0; i< this.newCss.length; i++) {
			var oldStyle = {};
			var dom = page.find(this.newCss[i].dom);
			for (var pname in this.newCss[i].style) {
				var pval = dom.css(pname);
				if (pval === undefined)
					pval = '';
				oldStyle[pname] = pval;
			}
			this.oldCss.push({ dom: this.newProps[i].dom, style: oldStyle});
		}
	},
	applyCss: function(css) {
	 	if (css == null) return;
		var page = PB.book().getPageById(this.pageId);
		var dom = $(page.getDom());
		this.saveCss(page);
		for (var i=0; i< css.length; i++) {
			var el = dom.find(css[i].dom);
			el.stop(true, true);
			if (this.animate)
				el.animate(css[i].style, 150);
			else
				el.css(css[i].style);
		}
		page.setModified();
	},
	toStringCss: function(cssSpec) {
		if (cssSpec == null)
			return "null";
		var s = "";
		cssSpec.forEach(function(el) {
			s += el.dom + " => ";
			for (prop in el.style)
				s += prop + ":" + el.style[prop] + ";";
		});
		return s;
	},
	toString: function() {
		var s = "ModifyCss\noldCss: " + this.toStringCss(this.oldCss) + "\n";
		s += "newCss: " + this.toStringCss(this.newCss);
		return s;
	}
}

PB.Manipulators = {
	
	createImageButton: function(kind, title, imageDiv, cursor) {
		var html = "<button class='image-button deleteme " + kind + "'>" + title + "</button>";
		var button = $(html).prependTo(imageDiv);
		var mouseCb = this[kind];
		this.bindButtonEvents(button, imageDiv, mouseCb, cursor);
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
					var computedStyle = window.getComputedStyle(newCss[i].dom.get(0));
					for (var pname in newCss[i].style) {
						var pval = computedStyle[pname];// dom.css(pname);
						if (pval === undefined) pval = '';
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
				var pageId = docEvents.data.imageDiv.parents(".page-enclosure").data("page_id");
				PB.CommandQueue.push(
					new PB.Commands.ModifyPageCSS(pageId, docEvents.newCss, docEvents.oldCss));
				$("body").css("cursor", "auto");
				$(document).unbind("mousemove", docEvents.mousemove);
				$(document).unbind("mousedown", docEvents.mousedown);
				$(document).unbind("mouseup", docEvents.mouseup);
			},
			 mouseup: function(ev) {
			 	// Click handling can be tricky.
			 	console.log("timedif is " + (ev.timeStamp - docEvents.data.timeStamp));
			 	if ((ev.timeStamp - docEvents.data.timeStamp) > 200)
			 		docEvents.mousedown(ev);
			 }
		};
		var buttonEvents = {
			mousedown: function(ev) {
				imageDiv.mouseleave();	// hides the buttons
				var image = imageDiv.find(".actual-image").get(0);
				docEvents.oldCss = null;
				docEvents.data = {
					timeStamp: ev.timeStamp,
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
				$(document).bind({
					mousedown: docEvents.mousedown,
					mousemove: docEvents.mousemove,
					mouseup: docEvents.mouseup
				});
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
		if (ev.shiftKey) // constrain to 45deg multiples
			angle = Math.round(angle * 4 / Math.PI) * Math.PI / 4;
		var css = {
			transform: "rotate(" + angle + "rad)"
		}
		this.setCss([{dom: this.data.imageDiv, style: css}]);
	}
}