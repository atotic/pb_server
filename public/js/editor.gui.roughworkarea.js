// editor.gui.roughworkarea.js

// Rough work area drag and drop handling

(function(scope) {
	var roughPageTarget = { target: null, direction: 0, dropFeedback: "" };

	var RoughWorkArea = {
		bindToBook: function(book) {
			this.makeDroppable();
			var roughPageList = book.roughPageList;
			$('#work-area-rough')
				.data('modelp', book.getProxy())
				.on( PB.MODEL_CHANGED, this.bookChanged);
			this.synchronizeRoughPageList();
		},
		get book() {
			return $('#work-area-rough').data('modelp').get();
		},
		getDragTarget: function(roughPage, clientX, clientY) {
			roughPage = $(roughPage).get(0);
			var r = roughPage.getBoundingClientRect();
			var retVal = { dom: $(roughPage).get(0), type: 'roughPage',
				offsetX: clientX - r.left, offsetY: clientY - r.top }
			$(roughPage).children().each(function() {
				var r = this.getBoundingClientRect();
				if ( scope.Util.pointInClientRect(clientX, clientY, r)) {
					if ($(this).hasClass('rough-tile')) {
						retVal.dom = this;
						retVal.type = 'roughImage';
						retVal.offsetX = clientX - r.left;
						retVal.offsetY = clientY - r.top;
					}
				}
			});
			return retVal;
		},
		makeDroppable: function() {
			$('#work-area-rough').attr('dropzone', true).on( {
				dragover: function(ev) { RoughWorkArea.dragover(ev.originalEvent) },
				dragleave: function(ev) { RoughWorkArea.dragleave(ev.originalEvent) },
				drop: function(ev) { RoughWorkArea.drop(ev.originalEvent) },
				dragenter: function(ev) { RoughWorkArea.dragenter(ev.originalEvent) }
			});
		},
		startDragEffect: function(target) {

		},
		stopDragEffect: function(target) {

		},
		logTargets: function(prefix, ev) {
			var s = prefix;
			if (ev.target)
				s += ' target: ' + ev.target.id + ' ' + ev.target.className;
			else
				s += ' target: null';
			if (ev.currentTarget)
				s += ' current: ' + ev.currentTarget.id + ' ' + ev.currentTarget.className;
			else
				s += ' current: null';
			console.log(s);
		},
		setTarget:	function (target, direction, dropFeedback) {
			direction = 'before';	// decided to ignore direction for now
			if (roughPageTarget.target == target && roughPageTarget.direction == direction)
				return;
			if (roughPageTarget.target) {
				$(roughPageTarget.target).removeClass(roughPageTarget.dropFeedback);
			}
			roughPageTarget = { target: target, direction: direction, dropFeedback: dropFeedback }
			if (target)
				$(target).addClass(dropFeedback);
		},

		dragenter: function(ev) {
			ev.stopPropagation();
			ev.preventDefault();
		},
		dragover: function(ev) {
			// Ignore unless drag has the right flavor
			if (! GUI.DragStore.hasType(
						GUI.DragStore.ROUGH_PAGE,
						GUI.DragStore.IMAGE,
						GUI.DragStore.ADD_PAGE_BUTTON,
						GUI.DragStore.ROUGH_IMAGE))
				return;

			ev.preventDefault();
			// Find the current drop location
			var newTarget = null;
			var newDirection = null;
			$(ev.currentTarget).children('.rough-page').each(function() {
				var direction = GUI.Util.pointInClientRect(ev.clientX, ev.clientY,
					this.getBoundingClientRect());
				if (direction) {
					newTarget = this;
					newDirection = direction;
					return false;
				}
			});
			// Display visual feedback
			switch(GUI.DragStore.type) {
			case 'roughPage':
			case 'addRoughPage':
				if (newTarget) {
					if (newTarget != GUI.DragStore.prop('dom'))
						this.setTarget(newTarget, newDirection, 'drop-target');
				}
				else
					this.setTarget();
				break;
			case 'image':
				if (newTarget)
					this.setTarget(newTarget, null, 'drop-target');
				else
					this.setTarget();
				break;
			case 'roughImage':
				if (newTarget && newTarget != $(GUI.DragStore.prop('dom')).parent('.rough-page').get(0))
					this.setTarget(newTarget, null, 'drop-target');
				else
					this.setTarget();
				break;
			default:
				console.error("Unknown drag type", GUI.DragStore.type);
			}
		},
		dragleave: function(ev) {
			// This will cause a dragover with an empty target
			this.dragover(ev);
		},
		drop: function(ev) {
			ev.preventDefault();
			if (!roughPageTarget.target)
				return;

			var t = {target: roughPageTarget.target, direction: roughPageTarget.direction};
			this.setTarget();	// reset the drag visuals

			switch(GUI.DragStore.type) {
			case 'roughPage':
				this.dropRoughPage(ev, t);
				break;
			case 'addRoughPage':
				this.dropAddButton(ev, t);
				break;
			case 'image':
				this.dropImage(ev, t);
				break;
			case 'roughImage':
				this.dropRoughImage(ev, t);
				break;
			default:
				throw "unknown drop type" + GUI.DragStore.type;
			}
			GUI.DragStore.hadDrop = true;
		},
		dropRoughPage: function(ev, t) {
			t.target = $(t.target);
			var src = $(GUI.DragStore.dom).data('modelp').get();
			var dest = $(t.target).data('modelp').get();
			var book = RoughWorkArea.book;
			book.moveRoughPage(src, book.roughPageList.indexOf(dest.id));
		},
		dropImage: function(ev, t) {
			var src = $(GUI.DragStore.dom);
			var roughModel = $(t.target).data('modelp').get();
			var photoModel = $(scope.DragStore.dom).data('modelp').get();
			roughModel.addPhoto(photoModel, {animate: true});
		},
		dropRoughImage: function(ev, t) {
			// move image from one rough to another
			var oldParent = $(GUI.DragStore.dom).parent();
			var photo = $(GUI.DragStore.dom).data('modelp').get();
			var oldModel = oldParent.data('modelp').get();
			var newModel = $(t.target).data('modelp').get();
			PB.startChangeBatch();
			oldModel.removePhoto(photo, {animate:true});
			newModel.addPhoto(photo, {animate:true});
			PB.broadcastChangeBatch();

		},
		dropAddButton: function(ev, t) {
			var destModel = $(t.target).data('modelp').get();
			destModel.book.insertRoughPage(destModel.indexOf(), {animate:true});
		}
	};

	var RoughWorkAreaEvents = {
		layoutRoughInsideTiles: function (domRough, animate) {
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
			if (pageModel.type() === 'pages')
				domPage.attr('draggable', true);
			if (pageModel.pageClass() !== 'page')
				domPage.addClass('rough-page-' + pageModel.pageClass());

			// Hook it up to the model
			domPage.data('modelp', pageModel.getProxy());
			domPage.on( PB.MODEL_CHANGED, RoughWorkArea.pageChanged);
			this.makeDraggable(domPage);
			return domPage;
		},
		renumberRoughPages: function() {
			$('#work-area-rough .rough-page').each(function(idx) {
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
		createRoughImageTile: function(photo) {
			var src = photo.getUrl(PB.Photo.SMALL);
			var domPhoto = $(document.createElement('div'));
			domPhoto.addClass('rough-tile');
			domPhoto.data('modelp', photo.getProxy());
			domPhoto.css('background-image', 'url("' + src + '")');
			return domPhoto;
		},
		// synchronizeRoughPageList and synchronizeRoughPhotoList
		// algorithms are almost identical
		synchronizeRoughPageList: function(options) {
			options = $.extend({animate:false}, options);
			var containerDom = $('#work-area-rough');
			var bookModel = containerDom.data('modelp').get();
			var sel = '.rough-page';

			var oldChildren = containerDom.children( sel );
			var oldPages = oldChildren.map(function(i,el) { return $(el).data('modelp').id}).get();
			var newPages = bookModel.roughPageList;

			var toId = function(el) { return el.id};

			var diff = JsonDiff.diff(oldPages, newPages);

			var newlyCreatedPages = [];
			for (var i=0; i< diff.length; i++) {
				var targetPath = JsonPath.query(oldPages, diff[i].path, {just_one: true, ghost_props: true});
				var targetIndex = targetPath.prop();
				var targetId = targetPath.val();
				switch(diff[i].op) {
				case 'set':
					var replaceDom = $(oldChildren.get(targetIndex));
					var newPage = bookModel.page(diff[i].args);
					var newDom = RoughWorkArea.createRoughPage(newPage);
					newlyCreatedPages.push( newDom);
					replaceDom.replaceWith(newDom);
				break;
				case 'insert':
					var newModel = bookModel.page( diff[i].args );
					var newDom = RoughWorkArea.createRoughPage(newModel);
					newlyCreatedPages.push(newDom);
					var c = containerDom.children(sel);
					if (c.length <= targetIndex) {
						if (c.length == 0)
							containerDom.prepend(newDom);
						else
							c.last().after(newDom);
					}
					else {
						$(c.get(targetIndex)).before(newDom);
					}
				break;
				case 'delete':
					$(containerDom.children(sel).get(targetIndex)).detach();
				break;
				case 'swap': // prop: index of old
					var src = containerDom.children(sel).get(targetIndex);
					var destIndex = JsonPath.lastProp(diff[i].args);
					var dest = containerDom.children(sel).get(destIndex);
					GUI.Util.swapDom(src, dest, options.animate);
				break;
				}
			}
			if (diff.length > 0)
				this.renumberRoughPages();
			if (newlyCreatedPages.length > 0) {
				for (var i=0; i< newlyCreatedPages.length; i++)
					this.synchronizeRoughPhotoList(newlyCreatedPages[i]);

				if (options.animate)
					GUI.Util.revealByScrolling(newlyCreatedPages[0], $('#pb-work-area'));
			}
		},
		// eventCallback when rough page changes
		// changed element's dom is 'this'
		synchronizeRoughPhotoList: function(roughDom, options) {
			options = $.extend( { animate: false }, options);
			var containerDom = $(roughDom);
			var pageModel = containerDom.data('modelp').get();
			var sel = '.rough-tile';

			var oldChildren = containerDom.children( sel );
			var oldPhotos = oldChildren.map(function(i, el) { return $(el).data('modelp').get()}).get();
			var newPhotos = pageModel.photos();
			var toId = function(el) { return el.id};
			var diff = JsonDiff.diff(
				oldPhotos.map(toId),
				newPhotos.map(toId) );

			for (var i=0; i < diff.length; i++) {
				var targetPath = JsonPath.query(oldPhotos, diff[i].path, {just_one: true, ghost_props: true});
				var targetIndex = targetPath.prop();
				var targetId = targetPath.val();
				switch(diff[i].op) {
					// op.args() is new photo id
				case 'set':
					var replaceDom = $(oldChildren.get(targetIndex));
					var newPhoto = pageModel.book.photo(diff[i].args);
					replaceDom.replaceWith(
							RoughWorkArea.createRoughImageTile(newPhoto));
				break;
				case 'insert':
					var newModel = pageModel.book.photo( diff[i].args );
					var newDom = RoughWorkArea.createRoughImageTile(newModel);
					var c = containerDom.children( sel );
					if (c.length <= targetIndex) {
						if (c.length == 0)
							containerDom.prepend(newDom);
						else
							c.last().after(newDom);
					}
					else {
						$(c.get(targetIndex)).before(newDom);
					}
				break;
				case 'delete':
					$(containerDom.children(sel).get(targetIndex)).detach();
				break;
				case 'swap': // prop: index of old
					var src = containerDom.children(sel).get(targetIndex);
					var destIndex = JsonPath.lastProp(diff[i].args);
					var dest = contanerDom.children(sel).get(destIndex);
					GUI.Util.swapDom(src, dest, options.animate);
				break;
				}
			}
			if (diff.length > 0)
				this.layoutRoughInsideTiles(containerDom, options.animate);
		},
		// #work-area-rough is 'this'
		bookChanged: function(ev, model, prop, options) {
			if (prop === 'roughPageList') {
				RoughWorkArea.synchronizeRoughPageList(options);
			}
		},
		// .rough-page is 'this'
		pageChanged: function(ev, model, prop, options) {
			options = $.extend( { animate: false }, options);
			var roughDom = $(this);
			if (prop === 'photoList')
				RoughWorkArea.synchronizeRoughPhotoList(roughDom, options);
		}
	};

	var RoughWorkAreaDnd = {
		makeDraggable: function(el) {	// makes rough-page draggable
			$(el).attr('draggable', true).on( {
				'dragstart': function(ev) {
					ev = ev.originalEvent;
					var target = RoughWorkArea.getDragTarget(this, ev.clientX, ev.clientY);
					var model = $(target.dom).data('modelp').get();
					if (model && !model.isDraggable()) {
						ev.preventDefault();
						return;
					}
					RoughWorkArea.startDragEffect(target);
					ev.dataTransfer.setData('text/plain', "page drag");
//					console.log("dragstart rough-page");
					GUI.DragStore.reset(target.type, {dom: target.dom});
					// TODO hide the page, create drag image from canvas
					ev.dataTransfer.setDragImage(target.dom, target.offsetX, target.offsetY);
					ev.dataTransfer.effectAllowed = "move";
				},
				'dragend': function(ev) {
//					console.log("DragStore.clear rough-page");
					RoughWorkArea.stopDragEffect(target);
					scope.DragStore.clear();
				}
			});
		}
	}

	var RoughWorkAreaTouch = {
		makeDraggable: function(el) {
			$(el).each(function() {
				var src = this;
				scope.TouchDragHandler.makeDraggable(src, function(element, clientX, clientY) {
					return RoughWorkArea.getDragTarget(element, clientX, clientY);
				});
			});
		}
	}

	$.extend(RoughWorkArea, RoughWorkAreaEvents);

	if (PB.hasTouch()) {
		$.extend(RoughWorkArea, RoughWorkAreaTouch);
	}
	else {
		$.extend(RoughWorkArea, RoughWorkAreaDnd);
	}
	scope.RoughWorkArea = RoughWorkArea;

})(window.GUI);

