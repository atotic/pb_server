// editor.gui.designworkarea.js

// #work-area-design implementation. Visible in 'Design' mode

/*
HTML hierarchy:
#work-area-design -> model(book)
 .design-book-page-left
 .design-book-page-right
	.design-page -> model(page)
		.design-photo -> layout-item-id(layoutId)
			.design-photo-inner
			img.design-photo-img
	.design-selection select-target(dom)
*/



(function(scope) {
var ID= '#work-area-design';

var Page = {
	bind: function(pageDom) {
		GUI.Events.Down.bind(pageDom, {
			action: function(ev) {
				Page.click(pageDom, ev);
			}
		});
	},
	click: function(page, ev) {
		page.find(".design-photo").each(function() {
			var r = this.getBoundingClientRect();
			if (ev.clientX > r.left && ev.clientX < r.right
				&& ev.clientY > r.top && ev.clientY < r.bottom) {
				ev.stopPropagation();
				ev.preventDefault();
				Page.select(this);
		}
		});
	},
	createSelectPopup: function(page, layoutItemId) {
		var popup = $("<ul class='dropdown-menu pb-popup'></ul>");
		page.getEditMenu(layoutItemId).forEach(
			function(title) {
				var li = $("<li><a href='#'>" + title + "</a></li>");
				GUI.Events.JSAnchor.bind(li.children('a'), {
					action: function(){
						GUI.DesignWorkArea.startEdit(page, layoutItemId, title);
					},
					title: title
				});
				popup.append(li);
			}
		);
		popup.addClass('design-select-popup');
		return popup;
	},
	select: function(el) {
		$(ID).find('.design-selection')
			.each(function() {
				$(this).data('select-popup').detach();
			})
			.detach();	// clears selection
		if (el == null)
			return;
		var designFrame = document.getElementById('work-area-design').getBoundingClientRect();
		var frame = el.getBoundingClientRect();
		var newSel = $(document.createElement('div'))
			.data('select-target', GUI.Util.getPath(el, 'work-area-design'))
			.addClass('design-selection');

		var designPage = $(el).parents('.design-page');
		GUI.Events.forward(newSel, designPage, ['mousedown', 'touchstart']);
		newSel.data('select-popup',
			this.createSelectPopup(
				PB.ModelMap.domToModel(designPage),
				$(el).data('layout-item-id')));
		this.positionSelection(newSel);

		$(ID).append(newSel);
	},
	positionSelection: function(el) {
		el = $(el);
		var target = $(el.data('select-target')).get(0);
		if (!target) {
			console.warn('lost selection');
			return;
		}
		var designFrame = document.getElementById('work-area-design').getBoundingClientRect();
		var frame = target.getBoundingClientRect();
		el.css({
			top: frame.top - designFrame.top,
			left: frame.left - designFrame.left,
			width: frame.width,
			height: frame.height
		});
		el.parent().append(el);	// be on top
		var popup = el.data('select-popup');
		// position popup here
		if (popup) {
			$(document.body).append(popup);
			var height = popup.height();
			var top = frame.top - height - 16;
			top = Math.max(top, 4);
			popup.css({
				top: top,
				left: frame.left
			});
		}
	},
	resizeSelection: function() {
		$('.design-selection').each(function() {
			Page.positionSelection(this);
		});
	}
}

var DesignWorkArea = {
	init: function() {
		this.createCommandSet();
		function buttonTimer(clickCount) {
			if (clickCount < 2)
				return 400;
			else
				return 100;
		};
		GUI.Events.RepeatFireButton.bind($('#work-area-design-btn-back'), {
			action: function() {GUI.DesignWorkArea.goBack()},
			delay: buttonTimer
		});
		GUI.Events.RepeatFireButton.bind($('#work-area-design-btn-forward'), {
			action: function() { GUI.DesignWorkArea.goForward()},
			delay: buttonTimer
		});
		$(ID).data('resize', function() {
			DesignWorkArea.resize();
		});
	},
	createCommandSet: function() {
		this.commandSet = new GUI.CommandSet("design");
		this.commandSet.add( new GUI.Command( {
			id: 'designBack',
			key: GUI.CommandManager.keys.leftArrow,
			action: function() { GUI.DesignWorkArea.goBack() }
		}));
		this.commandSet.add( new GUI.Command( {
			id : 'designForward',
			key: GUI.CommandManager.keys.rightArrow,
			action: function() { GUI.DesignWorkArea.goForward() }
		}));
	},
	bindToBook: function(book) {
		$(ID)
			.data('model_id', book.id)
			.on(PB.MODEL_CHANGED, this.bookChanged);
		try {
			this._lastPage = GUI.Options.designPage ? book.page(GUI.Options.designPage) : null;
		}
		catch(ex) {
			console.log("last page not found");
		}
	},
	get book() {
		return PB.ModelMap.domToModel($(ID));
	},
	get currentPage() {	// just first page
		var cp = this.currentPages;
		return cp[0] || cp[1];
	},
	get currentPages() { // returns left & right page. They might be null
		return [
		PB.ModelMap.domToModel(
			$('.design-book-page-left').not(':data(removed)').children('.design-page')),
		PB.ModelMap.domToModel(
			$('.design-book-page-right').not(':data(removed)').children('.design-page'))
		];
	},
	popupMenuClickHandler: function() {
		debugger;
		var popupCallback = $(this).parents('li').data('menu-action');
		if (popupCallback)
			popupCallback(this);
	},
	startEdit: function(page, layoutItemId, title) {
		console.log("startEdit");
	},

	bookChanged: function(ev, model, prop, options) {
		switch(prop) {
			case 'template':
				if ($(ID+':visible').length == 1)	//
					DesignWorkArea.show();
				break;
			default:
				;
		}
	},
	show: function() {
		$('#work-area').css({ paddingLeft: 0, paddingTop: 0});
		$(ID).show();
		this.showDesignArea(this._lastPage);
	},
	hide: function() {
		this._lastPage = this.currentPage;
		var workArea = document.getElementById('work-area');
		workArea.style.removeProperty('padding-left');
		workArea.style.removeProperty('padding-top');
		$(ID).hide();
		GUI.CommandManager.removeCommandSet(this.commandSet);
	},
	resize: function() {
		if (!($(ID).is(':visible')))
			return;
		try {
			var cur = this.currentPages;
			if (cur[0] || cur[1])
				this.showPages(cur, null, true);
			Page.resizeSelection();
		}
		catch(ex) {
			debugger;
		}
	},
	getPagePositions: function(book) {
		var vinset = 20;
		var hinset = 44;
		var dimensions = book.dimensions;
		var pageWidth = dimensions.width;
		var pageHeight = dimensions.height;
		var idWidth = $(ID).width() - hinset * 2;	// -1 for rounding errors
		var idHeight = $(ID).height() - vinset;
		var totalWidth = pageWidth * 2;
		var totalHeight = pageHeight;
		var hScale = idWidth / totalWidth;
		var vScale = idHeight / totalHeight;
		var scale = Math.min(Math.min(hScale, vScale), 1);
		var left = (idWidth - totalWidth * scale) / 2 + hinset;
		var top = 4 + (idHeight - totalHeight * scale) / 2;
		return {
			left: {
				x: left,
				y: top,
				width: pageWidth * scale,
				height: pageHeight * scale
			},
			right: {
				x: left + pageWidth * scale,
				y: top,
				width: pageWidth * scale,
				height: pageHeight * scale
			},
			pageWidth: pageWidth,
			pageHeight: pageHeight,
			scale: scale
		}
	},

	showPages: function(pages, direction, force) {
		if (!pages) {
			PB.error("page does not exist");
			this.goTo();
		}
		var currentPages = this.currentPages;
		if (currentPages.length == pages.length) {
			var diff = false;
			for (var i=0; i<currentPages.length; i++)
				if (currentPages[i] != pages[i])
					diff = true;
			if (!diff && !force)	// pages already shown, nothing to do
				return;
		}

		if (!force)
			Page.select();

		var pos = this.getPagePositions(this.book);
		var animate = direction == 'forward' || direction == 'back';

		// create new pages
		var pagesDom = [];
		var THIS = this;
		function makePageDom(page, options) {
			if (!page.designId)
				THIS.book.generateDesignId(page);
			return $(page.generateDom(options));
		}
		var loResOptions = {
			size: PB.PhotoProxy.SMALL,
			syncable: false,
			editable: false
		};
		var hiResOptions = {
			size: PB.PhotoProxy.MEDIUM,
			syncable: true,
			editable: true
		};
		for (var i=0; i<pages.length; i++) {
			if (pages[i] == null)
				continue;
			if (animate) {
				pagesDom[i] = makePageDom( pages[i], loResOptions);
				pagesDom[i].data('highDpi', makePageDom( pages[i], hiResOptions));
			}
			else
				pagesDom[i] = makePageDom(pages[i], PB.PhotoProxy.MEDIUM);
		}
		// create page containers
		var leftDom = $("<div class='design-book-page-left'/>");
		leftDom.css({
			top: pos.left.y,
			left: pos.left.x,
			width: pos.left.width,
			height: pos.left.height
		});
		var rightDom = $("<div class='design-book-page-right'/>");
		rightDom.css({
			top: pos.right.y,
			left: pos.right.x,
			width: pos.right.width,
			height: pos.right.height
		});
		// place new pages into containers
		if (pagesDom[0]) {
			var transform = 'scale(' + pos.scale.toFixed(4) + ')';
			pagesDom[0].css('transform', transform);
			if (pagesDom[0].data('highDpi'))
				pagesDom[0].data('highDpi').css('transform', transform);
			leftDom.append(pagesDom[0]);
			leftDom.append($('<p class="pageTitle">').text(pages[0].pageTitle()));
		}
		if (pagesDom[1]) {
			var transform = 'scale(' + pos.scale.toFixed(4) + ')';
			var widthDiff = pos.pageWidth - pagesDom[1].width();
			if (widthDiff > 5) {
				transform += ' translate(' + widthDiff.toFixed(4) + 'px)';
			}
			pagesDom[1].css('transform', transform);
			if (pagesDom[1].data('highDpi'))
				pagesDom[1].data('highDpi').css('transform', transform);
			rightDom.append(pagesDom[1]);
			rightDom.append($('<p class="pageTitle">').text(pages[1].pageTitle()));
		}
		// animate pages into view with 3D transitions
		// based upon http://jsfiddle.net/atotic/B8Rng/

		var workAreaDiv = $(ID);
		var oldLeft = workAreaDiv.find('.design-book-page-left').not(':data(removed)'); 	// 1
		var oldRight = workAreaDiv.find('.design-book-page-right').not(':data(removed)'); // 2
		var newLeft = pagesDom[0] ? leftDom : null; 								// 3
		var newRight = pagesDom[1] ? rightDom : null; 							// 4

		oldLeft.data('removed', true);
		oldRight.data('removed', true);

		function cleanUp() {
			// console.log('removing ', $(ID).children(':data(removed)').length);
			$(ID).children(':data(removed)').detach();
			$(ID).find('div:data(highDpi)').each( function() {
				var el = $(this);
				var highDpi = el.data('highDpi');
				el.replaceWith(highDpi);
				Page.bind(highDpi);
			});
		};

		if (animate) {
			oldLeft.find('.pageTitle').detach();
			oldRight.find('.pageTitle').detach();
			var duration = 500;
			if (direction == 'forward') {
				oldRight.css({
					transformOrigin: 'center left',
					backfaceVisibility: 'hidden'
				});
				if (newLeft)	// can be null in malformed books
					newLeft.css({
						transformOrigin: 'center right',
						backfaceVisibility: 'hidden'
					});
				// add pages in correct order for proper flip visibility
				// 4 1 3 2
				$(ID).append(newRight).append(oldLeft).append(newLeft).append(oldRight);
				if (oldRight.length > 0)
					oldRight.transition({transform: 'rotateY(-180deg)'}, duration, cleanUp);
				else
					cleanUp();
				if (newLeft) {
					newLeft.css('transform', 'rotateY(180deg)');
					newLeft.transition({ transform: 'rotateY(0deg)'}, duration);
				}
			}
			else if (direction == 'back') {
			// 3 1 2 4
				oldLeft.css({
					transformOrigin: 'center right',
					backfaceVisibility: 'hidden'
				});
				newRight.css({
					transformOrigin: 'center left',
					backfaceVisibility: 'hidden'
				});
				$(ID).append(newLeft).append(oldLeft).append(oldRight).append(newRight);
				if (oldLeft.length > 0)
					oldLeft.transition({transform: 'rotateY(180deg)'}, duration, cleanUp);
				else
					cleanUp();
				if (newRight) {
					newRight.css('transform', 'rotateY(-180deg)');
					newRight.transition({ transform: 'rotateY(0deg)'}, duration);
				}
			}
		}
		else { // no animation
			cleanUp();
			workAreaDiv.append(newRight).append(newLeft);
			Page.bind(newLeft);
			Page.bind(newRight);
		}
	},
	showDesignArea: function(page) {
		$('#palette, ' + ID).show();
		GUI.PhotoPalette.show();
		GUI.fixSizes($('#work-area'));

		GUI.CommandManager.addCommandSet(this.commandSet);
		DesignWorkArea.goTo(page);
	},
	goTo: function(page, direction) {
		var facingPages = this.book.facingPages;
		var show = facingPages.find(page);
		if (show === undefined)
			show = 0;
		else
			GUI.Options.designPage = page.id;
		// console.log("show", show, this.currentPage);
		this.showPages(facingPages.get(show), direction);
	},
	goBack: function() {
		if (this.currentPage == null)
			return;
		var show = this.book.facingPages.before(this.currentPage);
		this.goTo(show[0] || show[1], 'back');
	},
	goForward: function() {
		if (this.currentPage == null)
			return;
		var show = this.book.facingPages.after(this.currentPage);
		this.goTo(show[0] || show[1], 'forward');
	}
}

scope.DesignWorkArea = DesignWorkArea;

})(GUI);
