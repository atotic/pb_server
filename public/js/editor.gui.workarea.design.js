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
"use strict";

var DesignWorkArea = {
	init: function() {
		this.createCommandSet();
		var delay = 100;
		new GUI.Buttons.FireButton($('#work-area-design-btn-back'), {
			start: function($ev, $dom) {
				$dom.addClass('btn-success');
			},
			stop: function($ev, $dom) {
				$dom.removeClass('btn-success');
			},
			fire: function(howMany) {
				window.setTimeout( function() {
					DesignWorkArea.goBack(); // on timer to let tablets fire touchend event
				}, 0);
				return howMany > 0 ? delay : delay * 3;
			}
		});
		new GUI.Buttons.FireButton($('#work-area-design-btn-forward'), {
			start: function($ev, $dom) {
				$dom.addClass('btn-success');
			},
			stop: function($ev, $dom) {
				$dom.removeClass('btn-success');
			},
			fire: function(howMany) {
				window.setTimeout( function() {
					DesignWorkArea.goForward();
				}, 0);
				return howMany > 0 ? delay : delay * 3;
			}
		});
		$('#work-area-design').data('resize', function() {
			DesignWorkArea.resize();
		});
		$('#work-area-design').on('mousedown touchstart', function(ev) {
			DesignWorkArea.currentSelections.forEach(function(sel) {
				sel.setSelection();
			});
		});
		$('#add-text-btn').on('mousedown touchstart', function() {
			var lastSelection = DesignWorkArea.activeSelection;
			var assetId = lastSelection.page.addAsset({ type: 'text' });
			lastSelection.page.selectItem(lastSelection, assetId);
		});
	},
	createCommandSet: function() {
		this.commandSet = new GUI.CommandSet("design");
		this.commandSet.add( new GUI.Command( {
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
		$('#work-area-design')
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
		return PB.ModelMap.domToModel($('#work-area-design'));
	},
	get designPages() {
		var retVal = {
			left: $('.design-book-page-left').not(':data(removed)').children('.design-page'),
			right: $('.design-book-page-right').not(':data(removed)').children('.design-page')
		};
		if (retVal.left.length == 0)
			retVal.left = null;
		if (retVal.right.length == 0)
			retVal.right = null;
		return retVal;
	},
	get currentModels() { // returns left & right page. They might be null
		var dp = this.designPages;
		return {
			left: PB.ModelMap.domToModel( dp.left),
			right: PB.ModelMap.domToModel( dp.right)
		}
	},
	get firstVisiblePage() {
		var cm = this.currentModels;
		return cm.left || cm.right;
	},
	get activeModel() {
		var activeSel = this.activeSelection;
		return activeSel ? this.activeSelection.page : null;
	},
	get activeSelection() { // active, lastClicked page
		return this.currentSelections
			.sort( function(a,b) { return b.clickTime - a.clickTime; })
			[0];
	},
	get currentSelections() {	// all selections in the page
		var pages = this.designPages;
		var retVal = [];
		var leftSel = pages.left ? pages.left.data('page-selection') : null;
		var rightSel = pages.right ? pages.right.data('page-selection') : null;
		if (leftSel)
			retVal.push(leftSel);
		if (rightSel)
			retVal.push(rightSel);
		return retVal;
	},
	clearSelection: function() {
		this.currentSelections.forEach( function(sel) {
			sel.setSelection();
		});
	},
	bookChanged: function(ev, model, prop, options) {
		switch(prop) {
			case 'dimensions':
				DesignWorkArea.resize();
			break;
			default:
				;
		}
	},
	lastPaletteId: 'bookphoto',
	show: function() {
		if (this.book.themeId == null || !this.book.dimensions.width) {
			GUI.Options.designStage = 'theme'
			throw new Error("Cant design before assigning theme/width");
		}
		$('#work-area').css({ paddingLeft: 0, paddingTop: 0});
		$('#work-area-design').show();
		GUI.Palette.setupPicker(['bookphoto', 'theme', 'themepicker']);
		GUI.Palette.select( this.lastPaletteId || 'bookphoto' );
		GUI.WorkArea.Menu.setup(['add-photo-btn', 'add-text-btn', 'trash-btn']);
		GUI.CommandManager.addCommandSet(this.commandSet);
		if ( !this.activeSelection)
			DesignWorkArea.goTo(this._lastPage);
	},
	hide: function() {
		this.lastPaletteId = GUI.Palette.getCurrentPaletteId();
		var workArea = document.getElementById('work-area');
		workArea.style.removeProperty('padding-left');
		workArea.style.removeProperty('padding-top');
		$('#work-area-design').hide();
		GUI.CommandManager.removeCommandSet(this.commandSet);
		this.clearSelection();
	},
	resize: function() {
		if (!($('#work-area-design').is(':visible')))
			return;
		try {
			// console.log('resize', window.innerWidth, window.innerHeight);
			var cur = this.currentModels;
			if (cur.left || cur.right)
				this.showPages(cur, null, true);
		}
		catch(ex) {
			debugger;
		}
	},
	updateSelectionMenu: function(sel) {
		// console.log("updateSelectionMenu");
		// Clear menu
		var $menu = $('#selection-menu');
		$menu.empty();
		if ( this.selectionCommandSet )
			this.selectionCommandSet.deactivate();
		this.selectionCommandSet = sel.commandSet;
		if (!this.selectionCommandSet)
			return;
		// Empty all other selections. Be careful, without guards above this could get recursive
		this.currentSelections.forEach( function(otherSel) {
			if (otherSel && otherSel != sel)
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
	lastActiveSelection: null,
	updateActiveSelection: function() {
		var active = this.activeSelection;
		if (active != this.lastActiveSelection) {
			// console.log('updateActiveSelection');
			this.lastActiveSelection = active;
			this.broadcast('activeSelection', active);
		}
	},
	getPagePositions: function(book) {
		var vinset = 20;
		var hinset = 44;
		var dimensions = book.dimensions;
		var pageWidth = dimensions.width;
		var pageHeight = dimensions.height;
		var idWidth = $('#work-area-design').width() - hinset * 2;	// -1 for rounding errors
		var idHeight = $('#work-area-design').height() - vinset;
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
		var dp = this.designPages;
		if ( (dp.left && dp.left.hasClass('placeholder'))
			|| (dp.right && dp.right.hasClass('placeholder'))) {
						// console.log("fixingPlaceholders");
			this.showPages( this.currentModels, null, true);
		}
	},
	showPages: function(pageModels, direction, force) {
		var THIS = this;
		if (!pageModels) {
			PB.error("page does not exist");
			this.goTo();
		}
		var currentModels = this.currentModels;
		if (!force
			&& (currentModels.left == pageModels.left)
			&& (currentModels.right == pageModels.right))
			return; 	// pages already shown, nothing to do

		this._lastPage = pageModels.left || pageModels.right;

		var pos = this.getPagePositions(this.book);
		var animate = direction == 'forward' || direction == 'back';

		if (BrowserDetect.OS == 'iOS' || BrowserDetect.OS == 'Android')
			animate = false;
		// create new pages
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
					sel.addListener( function( propName, propVal) {
						switch( propName ) {
							case 'selection':
								THIS.updateSelectionMenu(sel);
							break;
							case 'clickTime':
								THIS.updateActiveSelection();
							break;
						}
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
				else
					console.warn("unexpected error generating page dom");
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
		var pagesDom = { left: null, right: null };
		for (var p in pagesDom) {
			if (pageModels[p] == null)
				continue;
			if (animate) {	// for animation, create lores, with hires in data
				pagesDom[p] = makePageDom( pageModels[p], loResOptions);
				pagesDom[p].data('highDpi', makePageDom( pageModels[p], hiResOptions));
			}
			else
				pagesDom[p] = makePageDom(pageModels[p], hiResOptions);
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
		if (pagesDom.left) {
			var transform = 'scale(' + pos.scale.toFixed(4) + ')';
			pagesDom.left.css('transform', transform);
			if (pagesDom.left.data('highDpi'))
				pagesDom.left.data('highDpi').css('transform', transform);
			leftDom.append(pagesDom.left);
			leftDom.append($('<p class="pageTitle">').text(pageModels.left.pageTitle()));
		}
		if (pagesDom.right) {
			var transform = 'scale(' + pos.scale.toFixed(4) + ')';
			var widthDiff = pos.pageWidth - pagesDom.right.width();
			if (widthDiff > 5) {
				transform += ' translate(' + widthDiff.toFixed(4) + 'px)';
			}
			pagesDom.right.css('transform', transform);
			if (pagesDom.right.data('highDpi'))
				pagesDom.right.data('highDpi').css('transform', transform);
			rightDom.append( pagesDom.right );
			rightDom.append($('<p class="pageTitle">').text(pageModels.right.pageTitle()));
		}
		// animate pages into view with 3D transitions
		// based upon http://jsfiddle.net/atotic/B8Rng/

		var workAreaDiv = $('#work-area-design');
		var oldLeft = workAreaDiv.find('.design-book-page-left').not(':data(removed)'); 	// 1
		var oldRight = workAreaDiv.find('.design-book-page-right').not(':data(removed)'); // 2
		var newLeft = pagesDom.left ? leftDom : null; 							// 3
		var newRight = pagesDom.right ? rightDom : null; 							// 4

		oldLeft.data('removed', true);
		oldRight.data('removed', true);

		function cleanUp() {
			// removes deleted elements, replaces pages with highDPI version
			// console.log('removing ', $(ID).children(':data(removed)').length);
			$('#work-area-design').children(':data(removed)').remove();
			$('#work-area-design').find('div:data(highDpi)').each( function() {
				var el = $(this);
				var highDpi = el.data('highDpi');
				el.replaceWith(highDpi);
			});
		};
		function saveSelection() {
			var sel = oldLeft.find('.design-page').data('page-selection');
			if (sel) savedSelection.left = sel.store();
			sel = oldRight.find('.design-page').data('page-selection');
			if (sel) savedSelection.right = sel.store();
		}
		function restoreSelection() {
			var sel;
			if (savedSelection.left && (sel = newLeft.find('.design-page').data('page-selection')))
				sel.restore(savedSelection.left);
			if (savedSelection.right && (sel = newRight.find('.design-page').data('page-selection')))
				sel.restore(savedSelection.right);
		}

		if (animate) {
			oldLeft.add( oldRight ).find('.pageTitle').remove();
			oldLeft.add( oldRight ).children('.design-page').trigger('pageRemoved');
			// oldRight.find('.pageTitle').remove();
			// oldLeft.children('.design-page').trigger('pageRemoved');
			// oldRight.children('.design-page').trigger('pageRemoved');
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
				$('#work-area-design').append(newRight).append(oldLeft).append(newLeft).append(oldRight);
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
				$('#work-area-design').append(newLeft).append(oldLeft).append(oldRight).append(newRight);
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
			var savedSelection = {};
			if (force)	// happens during window resize
				saveSelection();
			cleanUp();
			workAreaDiv.append(newRight).append(newLeft);
			if (force)
				restoreSelection();
		}
	},
	goTo: function(page, direction) {
		// console.log('goto', page ? page.id : page);
		var facingPages = this.book.facingPages;
		var show = facingPages.find(page);
		if (show === undefined)
			show = 0;
		else
			GUI.Options.designPage = page.id;
		this.showPages(facingPages.get(show), direction);
	},
	goBack: function() {
		// console.log('goBack');
		if (this.firstVisiblePage == null)
			return;
		var show = this.book.facingPages.before(this.firstVisiblePage);
		this.goTo(show.left || show.right, 'back');
	},
	goForward: function() {
		// console.log('goForward');
		if (this.firstVisiblePage == null)
			return;
		var show = this.book.facingPages.after(this.firstVisiblePage);
		this.goTo(show.left || show.right, 'forward');
	}
}

$.extend(DesignWorkArea, PB.ListenerMixin );
scope.DesignWorkArea = DesignWorkArea;

})(GUI);
