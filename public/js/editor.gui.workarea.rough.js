// editor.gui.roughworkarea.js

// #work-area-organize implementation. Visible in 'Organize' mode

(function(scope) {

	var RoughWorkAreaDroppable = new GUI.Dnd.Droppable( {
		flavors: [
			'page', // transferData: pageModelId
			'newPage', // transferData: null
			'osFile' // transferData: event.dataTransfer.files
			],
		enter: function($dom, flavor, transferData) {
			this.dom = $dom;
			this.target = null;
			switch(flavor) {
			case 'page':
				this.sourcePage = transferData;
			break;
			case 'osFile':
			case 'newPage':
				this.sourcePage = null;
			break;
			}
		},
		leave: function(transferDone) {
			if (this.target)
				this.target.removeClass('drop-target');
		},
		findRoughPage: function($ev) {
			var retVal = null;
			var screenLoc = GUI.Util.getPageLocation($ev);
			// TODO no tracking outside of our visible bounds
			var THIS = this;
			this.dom.find('.rough-page').each( function() {
				var bounds = new GUI.Rect( this.getBoundingClientRect()) ;
				bounds.moveBy( $(document).scrollLeft(), $(document).scrollTop() );
				if ( bounds.pointInRect( screenLoc.x, screenLoc.y) ) {
					retVal = $(this);
					return false;
				}
			});
			return retVal;
		},
		isValidTarget: function(target, flavor) {
			if (!target) return false;
			switch( flavor ) {
			case 'page':
			case 'newPage':
				var model_id = target.data('model_id');
				if (model_id == this.sourcePage) // can't drag on itself
					return false;
				if (PB.ModelMap.model(model_id).kind != 'page')
					return false;
			break;
			}
			return true;
		},
		move: function($ev, flavor) {
			var newTarget = this.findRoughPage($ev);
			if (newTarget != this.target) {
				if (this.target)
					this.target.removeClass('drop-target');
				if ( !this.isValidTarget( newTarget, flavor ) )
					newTarget = null;
				this.target = newTarget;
				if (this.target)
					this.target.addClass('drop-target');
			}
		},
		putTransferData: function($ev, flavor, transferData) {
			if (!this.target) {
				throw new Error('no page target');	// not really an error
			}
			switch(flavor) {
				case 'page':
					var src = PB.ModelMap.model( this.sourcePage );
					src.book.movePage( src,
						src.book.pageList.indexOf(
							this.target.data('model_id')
					));
				break;
				case 'osFile':
					var targetPage = PB.ModelMap.domToModel( this.target);
					targetPage.addOsFileList( transferData );
				break;
				case 'newPage':
					var targetPage = PB.ModelMap.domToModel( this.target );
					targetPage.book.addPage( targetPage.indexOf(), { animate: true });
				break;
			}
		}
	});
	var RoughPageDroppable = new GUI.Dnd.Droppable({
		flavors: [
			'photo',	// transferData: serverPhotoId
			'photoInRoughPage' // transferData: assetId
		],
		enter: function($dom, flavor, transferData) {
			this.dom = $dom;
			switch(flavor) {
			case 'photo':
				this.page = PB.ModelMap.domToModel($dom);
			break;
			case 'photoInRoughPage':
				this.destPage = PB.ModelMap.domToModel($dom);
				this.srcPageAsset = PB.ModelMap.model(transferData);
				if ( this.destPage == this.srcPageAsset.page )
					throw new Error('no dragging into same page');
			break;
			}
			this.dom.addClass('drop-target');
		},
		leave: function() {

			this.dom.removeClass('drop-target');
		},
		putTransferData: function( $ev, flavor, transferData ) {
			switch(flavor) {
			case 'photo':
				this.page.addAsset({
					type: 'photo',
					photoId: transferData
				},
				{animate: true});
			break;
			case 'photoInRoughPage':
				this.srcPageAsset.page.moveAsset( this.srcPageAsset.assetId, this.destPage, {animate: true});
			break;
			}
		}

	});

	var RoughPagePhotoDraggableOptions = {
		flavors: [
			'photoInRoughPage'	// transferData: assetId
		],
		assetId: 'your assetId here',
		getTransferData: function() {
			return this.assetId;
		},
		start: function($el, ev, startLoc) {
			this.el = $el;
			var bounds = $el[0].getBoundingClientRect();
			var $dom = GUI.Util.cloneDomWithCanvas($el)
				.addClass('touch-drag-src')
				.css( {
					top: startLoc.y + 2,
					left: startLoc.x + 2,
					marginLeft: bounds.left + $(document).scrollLeft() - startLoc.x,
					marginTop: bounds.top + $(document).scrollTop() - startLoc.y,
					position: 'absolute'
				});
			$el.css('opacity', 0);
			return $dom;
		},
		end: function(transferDone) {
			if (!transferDone)
				this.el.animate( {opacity: 1.0 }, 500);
		}
	};

	var RoughPageDraggableOptions = {
		flavors: [
			'page'	// transferData: pageModelId
		],
		pageId: ' your id here',
		getTransferData: function() {
			return this.pageId;
		},
		start: function($el, ev, startLoc) {
			this.el = $el;
			var bounds = $el[0].getBoundingClientRect();
			var $dom = GUI.Util.cloneDomWithCanvas($el)
				.addClass('touch-drag-src')
				.css( {
					top: startLoc.y + 2,
					left: startLoc.x + 2,
					marginLeft: bounds.left + $(document).scrollLeft() - startLoc.x,
					marginTop: bounds.top + $(document).scrollTop() - startLoc.y,
					position: 'absolute'
				});
			$el.css('opacity', 0);
			return $dom;
		},
		end: function(transferDone) {
			this.el.animate( {opacity: 1.0 },0);
		},
		doubleClick: function($el) {
			var THIS = this;
			window.setTimeout(function() {
				GUI.DesignWorkArea.goTo( RoughWorkArea.book.page( THIS.pageId ));
				GUI.WorkArea.show('work-area-design');
			},0);
		}
	}
	var roughPageTarget = { target: null, direction: 0, dropFeedback: "" };

	var RoughWorkArea = {
		bindToBook: function(book) {
			this.makeDroppable();
			var pageList = book.pageList;
			$('#work-area-organize')
				.data('model_id', book.id)
				.on( PB.MODEL_CHANGED, this.bookChanged);
			GUI.Options.addListener(this.optionsChanged);
			this.resizeAllPages();	// syncs css ruleset with options
			this.synchronizeRoughPageList();
		},
		get book() {
			return PB.ModelMap.domToModel($('#work-area-organize'));
		},
		optionsChanged: function(name, val) {
			switch(name) {
				case 'pageSize':
					GUI.RoughWorkArea.resizeAllPages();
					break;
				default:
					break;
			}
		},
		lastPaletteId: 'bookphoto',
		show: function() {
			$('#palette').show();
			$('#work-area-organize').show();
			GUI.Palette.setupPicker(['bookphoto']);
			GUI.Palette.select( this.lastPaletteId || 'bookphoto');
			this.processDelayUntilVisible();
			$('#workarea-menu').find('li').hide();
			$('#selection-menu').empty();
			$('#add-photo-btn,#add-page-btn').show();
		},
		hide: function() {
			this.lastPaletteId = GUI.Palette.getCurrentPaletteId();
			$('#work-area-organize').hide();
		},
		makeDroppable: function() {
			$('#work-area-organize').addClass('pb-droppable')
				.data('pb-droppable', RoughWorkAreaDroppable);
		},
	};

	var RoughWorkAreaEvents = {
		layoutRoughInsideTiles: function (domRough, animate) {
			if (this.delayUntilVisible(domRough, this.layoutRoughInsideTiles, [domRough]))
				return;
			domRough = $(domRough);
			var tiles = domRough.children('.rough-tile');
			var totalWidth = domRough.width();
			var totalHeight = domRough.height() - domRough.children('p').height();
			var tileCount = tiles.length;
			// Perfect fit edge length
			var edgeLength = Math.floor(Math.sqrt(totalWidth * totalHeight / tileCount));
			// shrink the edge until all tiles fit
			// Number of tiles that fits: floor(width / edge) * floor(height / edge)
			while (edgeLength > 8
				&& (Math.floor(totalWidth / edgeLength) * Math.floor(totalHeight / edgeLength)) < tileCount)
				edgeLength -= 1;
			if (animate)
				tiles.animate({height: edgeLength + 'px', width: edgeLength + 'px'});
			else
				tiles.css({width: edgeLength + "px", height: edgeLength + "px"});
		},
		createRoughPage: function(pageModel) {
			var domPage = $("<div class='rough-page'><p>" + pageModel.pageTitle() + "</p></div>");
			if (pageModel.kind !== 'page')
				domPage.addClass('rough-page-' + pageModel.kind);

			// Hook it up to the model
			domPage.data('model_id', pageModel.id);
			domPage.on( PB.MODEL_CHANGED, RoughWorkArea.pageChanged);
			// window.setTimeout(function() {	// iPad event binding workaround
			// 	RoughWorkArea.makeDraggable(domPage);
			// }, 0);
			domPage.addClass('pb-droppable')
				.data('pb-droppable', RoughPageDroppable);
			var dragOptions = $.extend({}, RoughPageDraggableOptions, { pageId: pageModel.id });
			if (pageModel.kind === 'page') {
				domPage.addClass('pb-draggable')
					.data('pb-draggable', new GUI.Dnd.Draggable( dragOptions ));
			}
//			this.makeDraggable(domPage);
			return domPage;
		},
		renumberRoughPages: function() {
			$('#work-area-organize .rough-page').each(function(idx) {
				if (idx < 4)
					return;
				var pNum = idx - 3;
				$(this).children('p').text(idx - 3);
				if (pNum % 2 == 1)
					$(this).removeClass('left-rough').addClass('right-rough');
				else
					$(this).removeClass('right-rough').addClass('left-rough');
			});
		},
		// syncs css with GUI.Options
		resizeAllPages: function() {
			var newSize = GUI.Options.pageSizePixels;
			try {
				var link = $('link[href="/css/editor.css"]').get(0);
				var rules = link.sheet.cssRules;
				for (var i=0; i<rules.length; i++) {
					var rule = rules[i];
					if (rule.type == 1) {
						switch (rule.selectorText) {
							case '.rough-page':
								rule.style.width = newSize + "px";
								rule.style.height = newSize + "px";
								break;
							case '.rough-page-cover-flap':
							case '.rough-page-back-flap':
								rule.style.width = Math.floor(newSize / 3) + "px";
								break;
							default:
								break;
						}
					}
				}
				$('#work-area-organize .rough-page').each(function() {
					GUI.RoughWorkArea.layoutRoughInsideTiles(this, false);
				});
			}
			catch(ex) {
				console.log("css rules API failed");
				debugger;
				$('#work-area-organize .rough-page').each(function() {
					var narrow = ($(this).hasClass('rough-page-cover-flap') || $(this).hasClass('rough-page-back-flap'));
					var width = narrow ? newSize / 3 : newSize;
					$(this).width(width).height(newSize);
					GUI.RoughWorkArea.layoutRoughInsideTiles(this, false);
				});
			}
		},
		createRoughImageTile: function( assetId ) {
			var pageAsset = PB.ModelMap.model(assetId);
			var photo = pageAsset.page.book.photo( pageAsset.page.getAsset( assetId ).photoId);
			var src = photo.getUrl(PB.PhotoProxy.SMALL);
			var domPhoto = $(document.createElement('div'));
			// Tricky, photo is both model of a photo, and an asset model
			domPhoto.addClass('rough-tile')
				.data('model_id', photo.id)
				.data('asset_id', assetId)
				.on(PB.MODEL_CHANGED, function(ev, model, prop, options) {
						switch(prop) {
						case 'icon_url':
							domPhoto.css('background-image', 'url("' + photo.getUrl(128) + '")');
						break;
						}
				});
			domPhoto.css('background-image', 'url("' + src + '")');
			var dragOptions = $.extend( {}, RoughPagePhotoDraggableOptions, {
				assetId: assetId
			});
			domPhoto.addClass('pb-draggable')
				.data('pb-draggable', new GUI.Dnd.Draggable( dragOptions ));
			return domPhoto;
		},
		// synchronizeRoughPageList and synchronizeRoughPhotoList
		// algorithms are almost identical
		synchronizeRoughPageList: function(options) {
			if (this.delayUntilVisible($('#work-area-organize'),this.synchronizeRoughPageList, options))
				return;
			options = $.extend({animate:false}, options);
			var containerDom = $('#work-area-organize');
			var bookModel = PB.ModelMap.domToModel(containerDom);
			var sel = '.rough-page';

			var oldChildren = containerDom.children( sel );
			var oldPages = oldChildren.map(function(i,el) { return $.data(el, 'model_id'); }).get();
			var newPages = bookModel.pageList;

			var toId = function(el) { return el.id};

			var diff = JsonDiff.diff(oldPages, newPages);

			var newlyCreatedPages = [];
			for (var i=0; i< diff.length; i++) {
				var targetPath = JsonPath.query(oldPages, diff[i].path, {just_one: true, ghost_props: true});
				var targetIndex = targetPath.prop();
				var targetId = targetPath.val();
				switch(diff[i].op) {
				case 'set':
					var newPage = bookModel.page(diff[i].args);
					var newDom = RoughWorkArea.createRoughPage(newPage);
					newlyCreatedPages.push(newDom);
					oldChildren = GUI.JQDiffUtil.set(oldChildren, targetIndex, newDom);
				break;
				case 'insert':
					var newModel = bookModel.page( diff[i].args );
					var newDom = RoughWorkArea.createRoughPage(newModel);
					newlyCreatedPages.push(newDom);
					oldChildren = GUI.JQDiffUtil.insert(oldChildren, containerDom, targetIndex, newDom);
				break;
				case 'delete':
					oldChildren = GUI.JQDiffUtil.delete(oldChildren, targetIndex);
				break;
				case 'swapArray': // prop: index of old
					var src = containerDom.children(sel).get(diff[i].args.srcIndex);
					var dest = containerDom.children(sel).get(diff[i].args.destIndex);
					oldChildren = GUI.JQDiffUtil.swap(oldChildren, src, dest);
				break;
				}
			}
			if (diff.length > 0)
				this.renumberRoughPages();

			if (newlyCreatedPages.length > 0) {
				for (var i=0; i< newlyCreatedPages.length; i++) {
					this.synchronizeRoughPhotoList(newlyCreatedPages[i]);
					if (options.animate)
						newlyCreatedPages[i].css('display', 'none').fadeIn();
				}
				if (options.animate)
					GUI.Util.revealByScrolling(newlyCreatedPages[0], $('#work-area-container'));
			}
		},
		// eventCallback when rough page asset list changes
		synchronizeRoughPhotoList: function($pageDom, options) {
			options = $.extend( { animate: false }, options);
			var $pageDom = $($pageDom);
			var pageModel = PB.ModelMap.domToModel($pageDom);

			var $oldChildren = $pageDom.children( '.rough-tile' );
			var oldAssetIds = $oldChildren.map( function(i, el) { return $(el).data('asset_id')}).get();
			var newAssetIds = pageModel.filterAssetIds('photo');
			var diff = JsonDiff.diff( oldAssetIds, newAssetIds );

			for (var i=0; i < diff.length; i++) {
				var targetPath = JsonPath.query(oldAssetIds, diff[i].path, {just_one: true, ghost_props: true});
				var targetIndex = targetPath.prop();
				var targetId = targetPath.val();
				switch(diff[i].op) {
					// op.args() is new photo id
				case 'set':
					var newAssetId = diff[i].args;
					$oldChildren = GUI.JQDiffUtil.set($oldChildren,
						targetIndex,
						RoughWorkArea.createRoughImageTile( newAssetId ) );
				break;
				case 'insert':
					var newAssetId = diff[i].args;
					var $newDom = RoughWorkArea.createRoughImageTile(newAssetId);
					$oldChildren = GUI.JQDiffUtil.insert($oldChildren, $pageDom, targetIndex, $newDom);
				break;
				case 'delete':
					$oldChildren = GUI.JQDiffUtil.delete($oldChildren, targetIndex);
				break;
				case 'swap': // prop: index of old
					var src = $pageDom.children('.rough-tile').get( diff[i].args.srcIndex );
					var dest = $pageDom.children('.rough-tile').get( diff[i].args.destIndex );
					$oldChildren = GUI.JQDiffUtil.swap($oldChildren, src, dest);
				break;
				}
			}
			if (diff.length > 0)
				this.layoutRoughInsideTiles($pageDom, options.animate);
		},
		// #work-area-organize is 'this'
		bookChanged: function(ev, model, prop, options) {
			if (prop === 'pageList') {
				RoughWorkArea.synchronizeRoughPageList(options);
			}
		},
		// .rough-page is 'this'
		pageChanged: function(ev, model, prop, options) {
			options = $.extend( { animate: false }, options);
			var roughDom = $(this);
			if (prop === 'assetList')
				RoughWorkArea.synchronizeRoughPhotoList(roughDom, options);
		}
	};


	$.extend(RoughWorkArea, RoughWorkAreaEvents);
	$.extend(RoughWorkArea, GUI.Mixin.DelayUntilVisible);

	scope.RoughWorkArea = RoughWorkArea;

})(window.GUI);

