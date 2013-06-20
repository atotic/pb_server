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
		this.commandSet = new GUI.CommandSet("design")
			.add( new GUI.Command( {
				id: 'designBack',
				key: GUI.CommandManager.keys.leftArrow,
				action: function() { GUI.DesignWorkArea.goBack() }
			}))
			.add( new GUI.Command( {
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
	get designPages() {
		return [
			$('.design-book-page-left').not(':data(removed)').children('.design-page'),
			$('.design-book-page-right').not(':data(removed)').children('.design-page')
		];
	},
	get currentPages() { // returns left & right page. They might be null
		return this.designPages.map( function(page) { return PB.ModelMap.domToModel(page) });;
	},
	get currentPage() {	// just first page
		var cp = this.currentPages;
		return cp[0] || cp[1];
	},
	get currentSelections() {
		var pages = this.designPages;
		var retVal = [];
		if (pages[0]) retVal.push( pages[0].data('page-selection'));
		if (pages[1]) retVal.push( pages[1].data('page-selection'));
		return retVal;
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
		if (this.book.themeId == null || !this.book.dimensions.width) {
			GUI.Options.designStage = 'theme'
			throw new Error("Cant design before assigning theme/width");
		}
		$('#work-area').css({ paddingLeft: 0, paddingTop: 0});
		$(ID).show();

		$('#palette, ' + ID).show();
		GUI.PhotoPalette.show();
		GUI.fixSizes($('#work-area'));
		GUI.CommandManager.addCommandSet(this.commandSet);
		DesignWorkArea.goTo(this._lastPage);
		// initialize workarea-menu
		$('#workarea-menu').find('li').hide();
		$('#add-photo-btn').show();
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
		}
		catch(ex) {
			debugger;
		}
	},
	updateSelectionMenu: function(sel) {
		// Clear menu
		$menu = $('#selection-menu');
		$menu.empty();
		if ( this.selectionCommandSet )
			this.selectionCommandSet.deactivate();
		this.selectionCommandSet = sel.commandSet;
		if (!this.selectionCommandSet)
			return;
		// Empty all other selections. Be careful, without guards above this could get recursive
		this.currentSelections.forEach( function(otherSel) {
			if (otherSel != sel)
				otherSel.setSelection();
		});
		this.selectionCommandSet = sel.commandSet;	// keep this, other selection might have reset it
		// Populate the menu
		this.selectionCommandSet.getCommands().forEach( function(cmd) {
			var $li = $('<li>');
			var $a = $('<a>');
			$a.text( cmd.title );
			if ( cmd.icon )
				$a.prepend( $('<i>').addClass('icon-' + cmd.icon ) );
			$li.append($a);
			$li.on('mousedown touchstart', function() {
				cmd.action( sel.dom, sel.selection[0]);
			});
			$menu.append($li);
		});
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

	fixPlaceholders: function() {
		console.log("fixingPlaceholders");
		var currentPages = this.currentPages;
		var left = $('.design-book-page-left').not(':data(removed)').children('.design-page');
		var right = $('.design-book-page-right').not(':data(removed)').children('.design-page');
		if (left.hasClass('placeholder') || right.hasClass('placeholder'))
			this.showPages( this.currentPages, null, true);
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

		var pos = this.getPagePositions(this.book);
		var animate = direction == 'forward' || direction == 'back';

		// create new pages
		var pagesDom = [];
		var THIS = this;
		function getPlaceholder(page) {
			var d = page.dimensions;
			return $('<div>')
				.css({
					width: d.width,
					height: d.height
				})
				.addClass('design-page placeholder')
				.data('model_id', page.id);
		};
		function makePageDom(page, options) {
			if (!page.designId)
				THIS.book.generateDesignId(page);
			try {
				var $dom = page.generateDom(options);
				if ( options.editable ) {
					var sel = PB.Page.Selection.findClosest($dom);
					sel.addListener( function() {
						THIS.updateSelectionMenu(sel);
					});
				}
				return $dom;
			}
			catch(ex) { // Display placeholder if load fails
				if (ex.name == "ThemeNotFoundException" && ex.deferred) {
					ex.deferred.done( function() {
						THIS.fixPlaceholders();
					});
				}
				return getPlaceholder(page);
			}
		};
		var loResOptions = {
			resolution: PB.PhotoProxy.SMALL,
			syncable: false,
			editable: false
		};
		var hiResOptions = {
			resolution: PB.PhotoProxy.MEDIUM,
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
				pagesDom[i] = makePageDom(pages[i], hiResOptions);
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
			// removes deleted elements, replaces pages with highDPI version
			// console.log('removing ', $(ID).children(':data(removed)').length);
			$(ID).children(':data(removed)').remove();
			$(ID).find('div:data(highDpi)').each( function() {
				var el = $(this);
				var highDpi = el.data('highDpi');
				el.replaceWith(highDpi);
			});
		};

		if (animate) {
			oldLeft.find('.pageTitle').remove();
			oldRight.find('.pageTitle').remove();
			oldLeft.children('.design-page').trigger('pageRemoved');
			oldRight.children('.design-page').trigger('pageRemoved');
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
			var leftSel, rightSel;
			cleanUp();
			workAreaDiv.append(newRight).append(newLeft);
		}
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
