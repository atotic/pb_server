// editor.gui.roughworkarea.js

// Rough work area drag and drop handling
// Implements:
// Drag sources:
// Rough page
// Rough page image
// Drag destinations:
// Rough page
(function(scope) {
	var roughPageTarget = { target: null, direction: 0, dropFeedback: "" };

	var RoughWorkArea = {
		init: function() {
			this.makeDroppable();
			$('.rough-page').each(function() {
				RoughWorkArea.makeDraggable(this);
			});
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
		dragenter: function(ev) {
			ev.stopPropagation();
			ev.preventDefault();
		},
		dragover: function(ev) {
			// Ignore unless drag has the right flavor
			if (!(scope.DragStore.roughPage
				|| scope.DragStore.image
				|| scope.DragStore.addRoughPage
				|| scope.DragStore.roughImage))
				return;
			ev.preventDefault();
			// Find the current drop location
			var newTarget = null;
			var newDirection = null;
			$(ev.currentTarget).children('.rough-page').each(function() {
				var direction = scope.Util.pointInClientRect(ev.clientX, ev.clientY,
					this.getBoundingClientRect());
				if (direction) {
					newTarget = this;
					newDirection = direction;
					return false;
				}
			});
			// Display visual feedback
			if (scope.DragStore.roughPage || scope.DragStore.addRoughPage) {
				if (newTarget) {
					if (newTarget != scope.DragStore.roughPage)
						this.setTarget(newTarget, newDirection, 'drop-target');
				}
				else
					this.setTarget();
			}
			else if (scope.DragStore.image) {
				if (newTarget)
					this.setTarget(newTarget, null, 'drop-target');
				else
					this.setTarget();
			}
			else if (scope.DragStore.roughImage) {
				if (newTarget && newTarget != $(scope.DragStore.roughImage).parent('.rough-page').get(0))
					this.setTarget(newTarget, null, 'drop-target');
				else
					this.setTarget();
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

			if (scope.DragStore.roughPage) {
				this.dropRoughPage(ev, t);
			}
			else if (scope.DragStore.addRoughPage) {
				GUI.Controller.addRoughPage(t.target, t.direction);
			}
			else if (scope.DragStore.image) {
				this.dropImage(ev, t);
			}
			else if (scope.DragStore.roughImage) {
				this.dropRoughImage(ev, t);
			}
			scope.DragStore.hadDrop = true;
		},
		dropRoughPage: function(ev, t) {
			t.target = $(t.target);
			var src = $(scope.DragStore.roughPage);
			// patch the location if src is before destination
			// to preserve visual consistency
			if (src.parent().children().get().indexOf(src.get(0)) <
				t.target.parent().children().get().indexOf(t.target.get(0)))
				t.direction = 'after';

			var oldWidth = src.width();
			src.animate({width: 0}, function() { // hide old
				scope.Util.moveNode(src, t.target, t.direction);
				src.animate({width: oldWidth}); // show new
				GUI.Controller.renumberRoughPages();
			});
		},
		dropImage: function(ev, t) {
			var src = $(scope.DragStore.image);
			var roughModel = $(t.target).data('model');
			var photoModel = $(scope.DragStore.image).data('model');
			roughModel.addPhoto(photoModel, {animate: true});
		},
		dropRoughImage: function(ev, t) {
			// move image from one rough to another
			var oldParent = $(scope.DragStore.roughImage).parent();
			var photo = $(scope.DragStore.roughImage).data('model');
			var oldModel = oldParent.data('model');
			var newModel = $(t.target).data('model');
			oldModel.removePhoto(photo, {animate:true});
			newModel.addPhoto(photo, {animate:true});
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
		createRoughImageTile: function(photo) {
			var src = photo.getUrl(PB.Photo.SMALL);
			var domPhoto = $(document.createElement('div'));
			domPhoto.addClass('rough-tile');
			domPhoto.data('model', photo);
			domPhoto.css('background-image', 'url("' + src + '")');
			return domPhoto;
		},
		populateRoughWithTiles: function(domRough) {
			this.synchronizeRoughPhotoList(domRough, {animate: false});
		},
		// eventCallback when rough page changes
		// changed element's dom is 'this'
		synchronizeRoughPhotoList: function(roughDom, options) {
			options = $.extend( { animate: false }, options);
			var roughDom = $(roughDom);
			var pageModel = roughDom.data('model');

			var oldChildren = roughDom.children('.rough-tile');
			var oldPhotos = oldChildren.map(function(i, el) { return $(el).data('model')}).get();
			var newPhotos = pageModel.photos();
			var photoToId = function(el) { return el.id};
			var diff = JsonDiff.diff(
				oldPhotos.map(photoToId),
				newPhotos.map(photoToId) );

			for (var i=0; i < diff.length; i++) {
				var targetPath = JsonPath.query(oldPhotos, diff[i].path, {just_one: true, ghost_props: true});
				var targetIndex = targetPath.prop();
				var targetId = targetPath.val();
				switch(diff[i].op) {
					// op.prop() is index of old element
					// op.args() is new photo id
					case 'set':
						var replaceDom = $(oldChildren.get(targetIndex));
						var newPhoto = pageModel.book.photo(diff[i].args);
						replaceDom.replaceWith(
								RoughWorkArea.createRoughImageTile(newPhoto)
						);
					break;
					case 'insert':
						var newPhoto = pageModel.book.photo( diff[i].args );
						var newTile = RoughWorkArea.createRoughImageTile(newPhoto);
						var c = roughDom.children('.rough-tile');
						if (c.length <= targetIndex) {
							if (c.length == 0)
								roughDom.prepend(newTile);
							else
								c.last().after(newTile);
						}
						else {
							$(c.get(targetIndex)).before(newTile);
						}
					break;
					case 'delete':
						$(roughDom.children().get(targetIndex)).detach();
					break;
					case 'swap': // prop: index of old
						PB.swapDom(targetIndex, diff[i].args);
					break;
				}
			}
			if (diff.length > 0)
				this.layoutRoughInsideTiles(roughDom, options.animate);
			JsonDiff.prettyPrint(diff);
		},
		// roughPageDom is 'this'
		pageChanged: function(ev, model, prop, options) {
			options = $.extend( { animate: false }, options);
			var roughDom = $(this);
			if (prop === 'photoList')
				RoughWorkArea.synchronizeRoughPhotoList(roughDom, options);
		},
		addPage: function(roughPage, options) {
			var defaults = {
				target: null,
				animate: false,
				renumber: true,
				direction: 'after',
			}
			$.extend(defaults, options);

			var domPage = $("<div class='rough-page'><p>" + roughPage.pageTitle() + "</p></div>");
			if (roughPage.type() === 'pages')
				domPage.attr('draggable', true);
			if (roughPage.pageClass() !== 'page')
				domPage.addClass('rough-page-' + roughPage.pageClass());

			// Hook it up to the model
			domPage.data('model', roughPage);
			domPage.on( PB.MODEL_CHANGED, RoughWorkArea.pageChanged);
			// Insert into dom
			if (defaults.animate)
				domPage.css('height', 0);

			// insert in the right spot
			if (defaults.target) {
				if (defaults.direction == 'before')
					$(defaults.target).before(domPage);
				else
					$(defaults.target).after(domPage);
			}
			else {
				$('#work-area-rough').append(domPage);
			}

			this.makeDraggable(domPage);

			// need to add left or right
			if (defaults.renumber)
				GUI.Controller.renumberRoughPages();

			if (defaults.animate) {
				domPage.animate({height: roughPageHeight},function() {
					domPage.css('display', 'auto');
					Controller.revealByScrolling(domPage, $('#pb-work-area'));
					RoughWorkArea.populateRoughWithTiles(domPage);
				});
			}
			else
				RoughWorkArea.populateRoughWithTiles(domPage);
		}
	};

	var RoughWorkAreaDnd = {
		makeDraggable: function(el) {	// makes rough-page draggable
			$(el).attr('draggable', true).on( {
				'dragstart': function(ev) {
					ev = ev.originalEvent;
					var target = RoughWorkArea.getDragTarget(this, ev.clientX, ev.clientY);
					var model = $(target.dom).data('model');
					if (model && !model.isDraggable()) {
						ev.preventDefault();
						return;
					}

					ev.dataTransfer.setData('text/plain', "page drag");
					console.log("dragstart rough-page");
					scope.DragStore.start()[target.type] = target.dom;
					// TODO hide the page, create drag image from canvas
					ev.dataTransfer.setDragImage(target.dom, target.offsetX, target.offsetY);
					ev.dataTransfer.effectAllowed = "move";
				},
				'dragend': function(ev) {
//					console.log("DragStore.clear rough-page");
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

	if (PB.hasTouch()) {
		$.extend(RoughWorkArea, RoughWorkAreaTouch);
	}
	else {
		$.extend(RoughWorkArea, RoughWorkAreaDnd);
	}
	scope.RoughWorkArea = RoughWorkArea;

})(window.GUI);

