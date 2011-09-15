/*
 * Standard Command Pattern
 * 
 * PB.CommandQueue keeps list of PB.Command , manages undo redo
 * 
 * 
 */
"use strict"

PB.CommandQueue = {

	completeQ: [],	// Already executed commands
	undoneQ: [], // Commands that have been undone
	
	trace: function(f) {
		return;
		console.log(f + this);
	},
	// Execute command, and push it onto the queue
	execute: function(command) {
		command.redo();
		if (command.canUndo()) {
			this.completeQ.push(command);
			this.trim();
			this.send('commandQueueChanged', this);
		}
		this.trace('execute');
	},
	
	// Push a command onto the queue, if 
	push: function(command) {
		if (command.canUndo()) {
			this.completeQ.push(command);
			this.undoneQ = [];
			this.trim();
			this.send('commandQueueChanged', this);
		}
		this.trace('push');
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
				this.trace('undo');
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
		this.trace('redo');
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

PB.Commands.DropImage = function(page, imageBroker, bookImage) {
	PB.guaranteeId(bookImage);
	this.bookImageId = $(bookImage).attr("id");
	this.imageBroker = imageBroker;
	this.page = page;
}

PB.Commands.DropImage.prototype = {
	canUndo: function() {
		return 'oldSrc' in this;
	},
	canRedo: function() {
		return true;
	},
	redo: function() {
		// Load in the dom
		var dom = $(this.page.getDom());
		var bookImage = dom.find("#" + this.bookImageId);
		var img = bookImage.find("img").get(0);
		// Save for redo
		this.oldSrc = img ? img.src : null;
		// Create the image
		if (img) 
			img.style.visibility = 'hidden';
		else {
			img = $('<img class="actual-image" style="visibility:hidden"/>').get(0);
			if ('generatedId' in this)	// if we have to recreate the element, recreate with same id
				img.id = this.generatedId;
			else {
				PB.guaranteeId(img);
				this.generatedId = img.id;
			}
			bookImage.append(img);
		}
	  img.onload = function(ev) {
				PB.UI.Bookpage.imageLoaded(bookImage);
				img.style.visibility = "visible";
		};
		this.page.setModified();
		img.src = this.imageBroker.getImageUrl('display');
	},
	undo: function() {
		// Load in the dom
		var dom = $(this.page.getDom());
		var bookImage = dom.find("#" + this.bookImageId);
		// Set the old image
		if (this.oldSrc != null)
			bookImage.find("img").attr("src", this.oldSrc);
		else
			bookImage.find("img").detach();
		PB.UI.Bookpage.imageLoaded(bookImage);
		this.page.setModified();
		delete this.oldSrc;
	},
	toString: function() {
		return "dropImage:" + this.imageBroker.id() + "=>" + this.bookImageId;
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
PB.Commands.ModifyPageCSS = function(page, newCss, oldCss) {
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
	this.page = page;
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
	saveCss: function() {
		if (this.oldCss)
			return;
		this.oldCss = [];
		for (var i=0; i< this.newCss.length; i++) {
			var oldStyle = {};
			var dom = this.page.find(this.newCss[i].dom);
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
		var dom = $(this.page.getDom());
		this.saveCss();
		for (var i=0; i< css.length; i++) {
			var el = dom.find(css[i].dom);
			el.stop(true, true);
			if (this.animate)
				el.animate(css[i].style, 150);
			else
				el.css(css[i].style);
		}
		this.page.setModified();
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

PB.Commands.ReplaceInnerHtml = function(page, dom, oldHtml, newHtml, oldWasDefault) {
	this.page = page;
	PB.guaranteeId(dom);
	this.domId = $(dom).prop("id");
	this.oldHtml = oldHtml;
	this.newHtml = newHtml;
	this.oldWasDefault = oldWasDefault;
}

PB.Commands.ReplaceInnerHtml.prototype = {
	canUndo: function() {
		return this.oldHtml != null;
	},
	canRedo: function() {
		return this.newHtml != null;
	},
	redo: function() {
		this.applyHtml(this.newHtml);
	},
	undo: function() {
		this.applyHtml(this.oldHtml);
	},
	applyHtml: function(html) {
		if (html == null) return;
		var dom = $(this.page.getDom());
		var el = dom.find("#" + this.domId)
		el.prop("innerHTML", html);
		if (html == this.oldHtml) {
			if (this.oldWasDefault)
				el.removeAttr("data-user_text");
		}
		else
			el.attr("data-user_text", "true");
		this.page.setModified();
	}
}

PB.Manipulators = {
	makeDroppableImage: function(el) {
		$(el).droppable({
			  	'hoverClass': "drop-feedback",
			  	'activeClass': 'drop-feedback',
			  	'drop': function(event, ui) {
			  		// when image drops, replace drop element with an image of the same size
			  		var imageBroker = $(ui.draggable).data('imageBroker');
			  		var page = $(this).parents(".page-enclosure").data("page");
			  		var cmd = new PB.Commands.DropImage(page, imageBroker, this);
			  		PB.CommandQueue.execute(cmd);
			  }});
	},
	createImageButtons: function(bookImage) {
		if (bookImage.find(".manipulator-button").length != 0)
			return;
		this.createImageButton("move", "move", bookImage, "move");
		this.createImageButton("pan", "pan", bookImage, "all-scroll");
		this.createImageButton("zoom", "zoom", bookImage, 'row-resize');
		this.createImageButton("rotate", "rotate", bookImage, 'nw-resize');
	},
	createButtonHtml: function(title) {
		return "<button class='manipulator-button deleteme'>" + title + "</button>";
	},
	createImageButton: function(kind, title, bookImage, cursor) {
		var html = this.createButtonHtml(title);
		var button = $(html).prependTo(bookImage);
		var mouseCb = this[kind];
		this.bindButtonEvents(button, bookImage, mouseCb, cursor);
	},
	removeButtons: function(el) {
		el.find(".manipulator-button").remove();
	},
	// Helper for setting css, and saving it as a command for undo/redo
	cssSetter: {
		oldCss: null,
		newCss: null,
		setCss: function(newCss) {
			this.saveOldCss(newCss);
			this.newCss = newCss;
			for ( var i=0; i< newCss.length; i++ )
				$( newCss[i].dom ).css( newCss[i].style );
			this.page.setModified();
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
		}
	},
	
	// 
	bindButtonEvents: function(button, bookImage, mouseCb, cursor) {
		var docEvents = {
			processMouse: mouseCb,
			page: $(bookImage).parents(".page-enclosure").data("page"),
			mousemove: function(ev) {
				var moveX = ev.pageX - docEvents.data.mouseStartX;
				var moveY = ev.pageY - docEvents.data.mouseStartY;
				docEvents.processMouse(docEvents.data, moveX, moveY, ev);
			},
			mousedown: function(ev) {
				console.log("mousedownDoc");
				var page = docEvents.data.bookImage.parents(".page-enclosure").data("page");
				PB.CommandQueue.push(
					new PB.Commands.ModifyPageCSS(page, docEvents.newCss, docEvents.oldCss));
				$("body").css("cursor", "auto");
				$(document).unbind("mousemove", docEvents.mousemove);
				$(document).unbind("mousedown", docEvents.mousedown);
				$(document).unbind("mouseup", docEvents.mouseup);
				bookImage.data("hide-manipulators", false);
			},
			 mouseup: function(ev) {
			 	// Click handling can be tricky.
			 	console.log("timedif is " + (ev.timeStamp - docEvents.data.timeStamp));
			 	if ((ev.timeStamp - docEvents.data.timeStamp) > 200)
			 		docEvents.mousedown(ev);
			 }
		};
		$.extend(docEvents, this.cssSetter);
		var buttonEvents = {
			mousedown: function(ev) {
				bookImage.data("hide-manipulators", true);
				bookImage.mouseleave();	// hides the buttons
				var image = bookImage.find(".actual-image").get(0);
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
					bookImage: bookImage,
					bookImageTop: parseFloat(bookImage.css("top")),
					bookImageLeft: parseFloat(bookImage.css("left")),
					bookImageWidth: parseFloat(bookImage.css("width")),
					bookImageHeight: parseFloat(bookImage.css("height")),
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

	clamp: function (val, lo, hi) {
//			console.log("clamp " + val + " lo:" + lo + " hi:" + hi);
			if (val < lo) return lo;
			if (val > hi) return hi;
			return val;
	},

	pan: function (data, moveX, moveY, ev) {
		if (! ('transformMatrix' in data))
			data.transformMatrix = $.transformMatrix(data.bookImage.css("transform"));
		var transX = data.transformMatrix[0] * moveX + data.transformMatrix[1] * moveY;
		var transY = data.transformMatrix[2] * moveX + data.transformMatrix[3] * moveY;
		var top = data.imageTop + transY;
		top = PB.Manipulators.clamp(top, 
			data.bookImageHeight - data.imageHeight, 0);

		var left = data.imageLeft + transX;
		left = PB.Manipulators.clamp(left, 
			data.bookImageWidth - data.imageWidth, 0);
		var css = {
			top: top + "px",
			left: left + "px"
		}
		this.setCss([{dom: data.image, style: css}]);
	},

	move: function (data, moveX, moveY, ev) {
		var top = data.bookImageTop + moveY;
		var left = data.bookImageLeft + moveX;
		var page = data.bookImage.parents(".book-page");
		top = PB.Manipulators.clamp(top,
			-20, page.height() - data.bookImage.height() + 20);
		left = PB.Manipulators.clamp(left,
			-20, page.width() - data.bookImage.width() + 20);
		var css = {
			top: top + "px",
			left: left + "px"
		}
		this.setCss([{dom: data.bookImage, style: css}]);
	},

	zoom: function(data, moveX, moveY, ev) {
		// compute height
		var height = data.imageHeight - moveY * 2;
		height = PB.Manipulators.clamp(height, data.bookImageHeight, 2000);
		// scale width by same amount
		var scale = height / data.imageHeight;
		var width = data.imageWidth * scale;
		// clamp both if width is too small
		if (width < data.bookImageWidth) {
			width = data.bookImageWidth;
			height = width / data.imageWidth * data.imageHeight;
		}
		// move left/top proportionally
		// performs: left_new = left_old * (width_new - width_div)/(width_old - width_div)
		var left = data.imageLeft - ( width - data.imageWidth) / 2;
		left = PB.Manipulators.clamp(left, 
			data.bookImageWidth - width, 0);
		var top = data.imageTop - ( height - data.imageHeight) / 2;
		top = PB.Manipulators.clamp(top, 
			data.bookImageHeight - height, 0);

		var css = {
			top: top + "px",
			left: left + "px",
			height: height + "px",
			width: width + "px"
		}
		this.setCss([{dom: data.image, style: css}]);
	},

	rotate: function(data, moveX, moveY, ev) {
		// Rotate
		// compute angle, pythagora
		if (! ('oldRotation' in data))
			data.oldRotation = $.transformUnmatrix($.transformMatrix(data.bookImage.css("transform"))).rotate;
		var b = data.centerY - ev.pageY;
		var a = ev.pageX - data.centerX;
//		console.log("Y:" +b + " X:" + a);
		var c = Math.sqrt(a*a+b*b);
		var angle = Math.asin(b / c);
		if (a < 0)
			angle = Math.PI / 2 + ( Math.PI / 2 - angle);
		angle = -angle;
//		console.log("angle is " + ( 360 * angle / 2 / Math.PI));
		angle += data.oldRotation;
		if (ev.shiftKey) // constrain to 45deg multiples
			angle = Math.round(angle * 4 / Math.PI) * Math.PI / 4;
		var css = {
			transform: "rotate(" + angle + "rad)"
		}
		this.setCss([{dom: data.bookImage, style: css}]);
	}
}
PB.Manipulators.Text = {
	// Clicking on text field starts edit mode
	// Clicking anywhere else in the document ends edit mode 
	makeEditable: function(bookText) {
		bookText = $(bookText);
		var actualText = bookText.find('.actual-text');
		if (actualText.length == 0) {
			// If actual text does not exist, create and populate with current contents of bookText
			// This allows template writers to create simple templates
			var newActual = $("<div class='actual-text'></div>");
			newActual.append(bookText.contents());
			bookText.empty().append(newActual);
			actualText = bookText.find('.actual-text');
		}
		// If actual text has no tags, wrap it up in a <p>
		if (actualText.children().length == 0)
			actualText.prop("innerHTML", "<p>" + actualText.prop("innerHTML") + "</p>");
		PB.guaranteeId(bookText);
		PB.guaranteeId(actualText);
		console.log("Editing", bookText.prop("id"));
		var textEvents = {
			mousedown: function(ev) {
				console.log("edit started");
				// FF editing setup https://developer.mozilla.org/en/rich-text_editing_in_mozilla
				document.execCommand("enableObjectResizing", false, false);
				document.execCommand("insertBrOnReturn", false, false);
				actualText.prop("contentEditable", true);
				if (! ("oldHtml" in textEvents)) {
					textEvents.oldHtml = actualText.prop("innerHTML");
					if (textEvents.oldHtml.indexOf('<') == -1)
						textEvents.oldHtml = "<p>" + textEvents.oldHtml + "</p>";
					textEvents.oldIsDefault = ! actualText.attr("data-user_text");
					if (textEvents.oldIsDefault) {
						// Want to clear default text here, but can't
						// Clearing text on mousedown prevents field from being editable.
						// Workaround: select all text, so typing erases it
								window.setTimeout(function() {
									var sel = window.getSelection();
									sel.selectAllChildren(actualText.get(0));
								}, 0);
					}
				}
				bookText.mouseleave();
			},
			blur: function(ev) {
				actualText.removeAttr("contentEditable");
				// Clean up the editing artifacts
				actualText.find("*").removeAttr("_moz_dirty");
				actualText.find("br").removeAttr("type");
				// Clean up hazards of pasted html
				actualText.find("*").removeAttr("id")
					.removeAttr("class")
					.removeAttr("data-ft")
					.removeAttr("tabindex")
					.removeAttr("data-hovercard")
					.removeAttr("target");
				var newHtml = actualText.prop("innerHTML");
				if (newHtml != textEvents.oldHtml) {
					if (textEvents.oldIsDefault)
						actualText.attr("data-user_text", true);
					var page = actualText.parents(".page-enclosure").data("page");
					page.setModified();
					// create a command, so we can undo
					PB.CommandQueue.push(new PB.Commands.ReplaceInnerHtml(page, actualText, textEvents.oldHtml, newHtml, textEvents.oldIsDefault));
				}
				delete textEvents.oldHtml;
				return true;
			}
		};
		actualText.bind(textEvents);
	},
	
	// Creates text manipulators
	createTextButtons: function(bookText) {
		bookText = $(bookText);
		if (bookText.find(".manipulator-button").length != 0)
			return;
		this.createMoveButton(bookText);
		this.createResizeButton(bookText);		
	},
	createMoveButton: function(bookText) {
		var html = "<button class='manipulator-button deleteme'>move</button>";
		var button = $(html).prependTo(bookText);
		button.css({
			position: "absolute",
			top: "-10px",
			left: "0px"
		});
		var docEvents = {
			page: $(bookText).parents(".page-enclosure").data("page"),
			processMouse: function(data, moveX, moveY, ev) {
				var top = data.textTop + moveY;
				var left = data.textLeft + moveX;
				var page = data.bookText.parents(".book-page");
				top = PB.Manipulators.clamp(top,
					0, page.height() - data.bookText.height() + 20);
				left = PB.Manipulators.clamp(left,
					-20, page.width() - data.bookText.width() + 20);
				var css = {
					top: top + "px",
					left: left + "px"
				};
				this.setCss([{dom: data.bookText, style: css}]);
			},
			mousemove: function(ev) {
				var moveX = ev.pageX - docEvents.data.mouseStartX;
				var moveY = ev.pageY - docEvents.data.mouseStartY;
				docEvents.processMouse(docEvents.data, moveX, moveY, ev);
			},
			mousedown: function(ev) {
				var page = docEvents.data.bookText.parents(".page-enclosure").data("page");
				PB.CommandQueue.push(
					new PB.Commands.ModifyPageCSS(page, docEvents.newCss, docEvents.oldCss));
				$("body").css("cursor", "auto");
				bookText.data("hide-manipulators", false);		
				$(document).unbind("mousemove", docEvents.mousemove);
				$(document).unbind("mousedown", docEvents.mousedown);
				$(document).unbind("mouseup", docEvents.mouseup);
			},
			 mouseup: function(ev) {
			 	// If mouseup is long, assume we were doing click and drag
			 	console.log("timedif is " + (ev.timeStamp - docEvents.data.timeStamp));
			 	if ((ev.timeStamp - docEvents.data.timeStamp) > 200)
			 		docEvents.mousedown(ev);
			 }
		};
		$.extend(docEvents, PB.Manipulators.cssSetter);
		var buttonEvents = {
			mousedown: function(ev) {
				docEvents.data = {
					timeStamp: ev.timeStamp,
					mouseStartX: ev.pageX,
					mouseStartY:ev.pageY,
					bookText: bookText,
					textTop: parseFloat(bookText.css("top")),
					textLeft: parseFloat(bookText.css("left"))
				};
				ev.preventDefault(); ev.stopPropagation();
				$("body").css("cursor", "move");
				bookText.data("hide-manipulators", true);		
				bookText.mouseleave();	// hides the buttons
				$(document).bind({
					mousedown: docEvents.mousedown,
					mousemove: docEvents.mousemove,
					mouseup: docEvents.mouseup
				});
			}
		};
		button.bind(buttonEvents);				
	},
	createResizeButton: function(bookText) {
		var html = "<img class='manipulator-button deleteme' src='/images/corner-icon.png'>";
		var button = $(html);
		button.css({
			position: "absolute",
			top: (bookText.height() - 7) + "px",
			left: (bookText.width() - 7) + "px"
		});
		button.prependTo(bookText);
		var docEvents = {
			page: $(bookText).parents(".page-enclosure").data("page"),
			mouseup: function(ev) {
				PB.CommandQueue.push(
					new PB.Commands.ModifyPageCSS(docEvents.page, docEvents.newCss, docEvents.oldCss));
				$("body").css("cursor", "auto");
				bookText.data("show-manipulators", false);
				bookText.mouseleave();
				$(document).unbind("mousemove", docEvents.mousemove);
				$(document).unbind("mouseup", docEvents.mouseup);
			},
			mousemove: function(ev) {
				var moveX = ev.pageX - docEvents.data.mouseStartX;
				var moveY = ev.pageY - docEvents.data.mouseStartY;
				docEvents.processMouse(docEvents.data, moveX, moveY, ev);
			},
			processMouse: function(data, moveX, moveY, ev) {
				var page = bookText.parents(".book-page");
				var width = data.textWidth + moveX;
				width = PB.Manipulators.clamp(width,
					10,  page.width());
				var css = {
					width: width + "px",
				};
				this.setCss([{dom: bookText, style: css}]);
				button.css({
					top: (bookText.height() - 7) + "px",
					left: (bookText.width() - 7) + "px"
				});
			},
		}
		$.extend(docEvents, PB.Manipulators.cssSetter);
		var buttonEvents = {
			mousedown: function(ev) {
				docEvents.data = {
					mouseStartX: ev.pageX,
					mouseStartY: ev.pageY,
					textWidth: bookText.width()
				}
				ev.preventDefault(); ev.stopPropagation();
				$("body").css("cursor", "col-resize");
					bookText.data("show-manipulators", true);		
					$(document).bind({
					mousemove: docEvents.mousemove,
					mouseup: docEvents.mouseup
				});				
			}
		}
		button.bind(buttonEvents);
	}
}