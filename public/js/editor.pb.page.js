// editor.pb.page.js

/* DATA DICTIONARY

BookPage JSON {
	needReflow: false
	assets: {	// Hash of all the assets, + sorted
		ids: [ list of all asset ids in order ]
		asset_id : { asset }
		asset_id2: { asset }
	},
	dimensions: null
	designId: null,
	layoutId: null,
	layoutData: null,
	backgroundId: null,
	backgroundData: null,
}
}
asset {
	type: 'photo' | 'text' | 'widget'
	css {	// css always exists
		top     // undefined means widget has not been positioned
		left
		width
		height
		zIndex // default text 2, widget 1
	}
	rotate	// angle in degrees
	frameId
	frameData
	dependentOf: {
		assetId:
		assetPositionerId:
	}
}
asset photo {
	type: 'photo'
	photoId // bookPhotoId
	focalPoint { xy %, default 50}
	zoom { 1.0,}
	photoRect { tlwh } // automatically generated
}
asset text {
	type: 'text'
	content: '' // plain text
}
asset widget {
	type: 'widget'
	widgetId:
	widgetOptions:
	widgetCreator: user | designId
}
*/

(function(scope){

"use strict";

	function registerPageAssetResolver(pageProxy, assetId) {
		var book = pageProxy.book;
		PB.ModelMap.setResolver( assetId, function() {
			var page = book.page(pageProxy.id);
			var asset = page.p.assets[assetId];
			if (!asset)
				PB.debugstr("Resolving asset not there");
			return { page: page, asset: asset, assetId: assetId };
		});
	};
	var PageProxy = function(id, book) {
		this.id = id;
		this.book = book;
		PB.ModelMap.setResolver( id, book.pageResolver() );
		this.registerAssetIdResolvers();
	};


	var coverRegex = /^cover|^cover-flap|^back-flap|^back/;

	PageProxy.prototype = {
		get p() {
			return this.book.localData.document.pages[this.id];
		},
		isDraggable: function() {
			return this.id.match(coverRegex) === null;
		},
		type: function() {
			debugger; // should use get pageClass()
		},
		get photoList() {
			debugger;
		},
		get dimensions() {
			return this.p.dimensions;
		},
		set dimensions(d) {
			if (d == null)
				this.p.dimensions = d;
			else
				this.p.dimensions = { width: d.width, height: d.height };
			this.p.needReflow = true;
			PB.broadcastChange(this, 'dimensions');
		},
		get needReflow() {
			return this.p.needReflow;
		},
		// indexOf this page inside the book
		indexOf: function() {
			return this.book.pageList.indexOf(this.id);
		},
		get kind() { // cover | cover-flap | back-flap | back | page
			return this.p.kind || 'page';
		},
		pageTitle: function() {
			switch(this.kind) {
				case 'cover': return 'cover';
				case 'cover-flap': return 'flap';
				case 'back-flap': return 'flap';
				case 'back': return 'back';
				default:
					return this.book.pageList.indexOf(this.id) - 3;
			}
		},
		swapPhoto: function(oldId, newId) {
			var assets = this.getAssets();
			for (var i=0; i<assets.ids.length; i++) {
				var asset = assets[ assets.ids[i] ];
				if (asset.photoId == oldId)
					asset.photoId = newId;
			}
		},
		registerAssetIdResolvers: function() {
			this.p.assets.ids.forEach( function( assetId ) {
				registerPageAssetResolver( this, assetId );
			}, this );
		},
		remove: function(options) {
			this.book.removePage(this, options);
		},
		getAssets: function() {
			return this.p.assets;
		},
		debugAssets: function() {
			function printAsset(asset, assetId) {
				var indent = asset.dependentOf ? '  ' : '';
				switch(asset.type) {
					case 'photo':
						console.log(indent, assetId, ' photo ', asset.photoId, asset.css.top, asset.css.left);
						break;
					case 'text':
						console.log(indent, assetId, ' text ', asset.content, asset.css.top, asset.css.left);
					break;
					case 'widget':
						console.log(indent, assetId, ' widget ', asset.widgetId, asset.css.top, asset.css.left );
					break;
				}
			}
			var assets = this.p.assets;
			for (var i=0; i<assets.ids.length; i++) {
				var asset = assets[ assets.ids[i]];
				if (!asset.dependentOf) {
					printAsset(asset, assets.ids[i]);
					this.getDependentsIds( assets.ids[i]).forEach( function(id) {
						printAsset( assets[id], id);
					});
				}
			}
		},
		getAsset: function(assetId) {
			return this.p.assets[ assetId ];
		},
		getDependentsIds: function(assetId) {
			var retVal = [];
			var assets  = this.p.assets;
			for ( var i=0; i<assets.ids.length; i++) {
				var asset = assets[ assets.ids[i]];
				if (asset.dependentOf && asset.dependentOf.assetId == assetId)
					retVal.push( assets.ids[i]);
			}
			return retVal;
		},
		findAssetIdByPhotoId: function( photoId ) {
			var assets = this.p.assets;
			for ( var i=0; i<assets.ids.length; i++ )
				if ( assets[ assets.ids[i] ].photoId == photoId )
					return assets.ids[i];
			console.warn('photo asset not found', photoId);
			return null;
		},
		filterAssetIds: function(assetType) {
			var retVal = [];
			for (var i=0; i<this.p.assets.ids.length; i++) {
				var assetId = this.p.assets.ids[i];
				if (!assetType || this.p.assets[assetId].type == assetType)
					retVal.push(assetId);
			}
			return retVal;
		},
		broadcastPhotosChanged: function(options) {
			this.book._pagePhotosChanged(this, options);
		},
		get canSave() {
			return !this.hasTemporaryChanges;
		},
		startTemporaryChanges: function() {
			this.hasTemporaryChanges = true;
		},
		endTemporaryChanges: function() {
			this.hasTemporaryChanges = false;
		},
		// return asset id
		addAsset: function(asset, addAssetOptions) {
			addAssetOptions = $.extend( {
				broadcast: true, 	// should we broadcast the addition?
				assetId: null, 	// asset id to use
				addCaption: true,
				animate: false
			}, addAssetOptions);

			asset = PB.clone(asset);
			if ( !asset.css )
				asset.css = {};
			if ( !asset.css.top )
				this.p.needReflow = true;

			if (asset.type == 'photo') {
				// if photo id is serverPhotoId, convert it to bookPhotoId
				if (! this.book.serverPhotoId(asset.photoId) ) {
					asset.photoId = this.book.bookPhotoId( asset.photoId ) || this.book.addServerPhoto( asset.photoId );
				}
			}
			// Add the asset to the list
			var id = addAssetOptions.assetId ? addAssetOptions.assetId : this.book.generateId();
			this.p.assets.ids.push( id );
			this.p.assets[ id ] = asset;
			registerPageAssetResolver(this, id);

			// Post processing
			switch(asset.type) {
			case 'widget':
				if (!asset.widgetCreator)
					asset.widgetCreator = 'user';
				// User-created widgets are placed in the center of the page by default
				if ( asset.widgetCreator == 'user' && !asset.css.top ) {
					var widget = PB.ThemeCache.resource( asset.widgetId );
					var d = this.dimensions;
					var width = widget.width( asset.widgetOptions );
					var height =  widget.height( asset.widgetOptions );
					asset.css = {
						width: width,
						height: height,
						top: Math.max(0, (d.height - height) / 2),
						left:  Math.max(0, (d.width - width) / 2)
					}
				}
			break;
			case 'photo':
				if (addAssetOptions.addCaption) {
					var photo = this.book.photo(asset.photoId);
					if (photo.caption) {
						this.addAsset( {
							type: 'text',
							content: photo.caption,
							dependentOf: { assetId: id }
						});
					}
				}
			break;
			}

			// Broadcast changes
			if ( asset.type == 'photo' )
				this.broadcastPhotosChanged( addAssetOptions );
			if ( addAssetOptions.broadcast )
				PB.broadcastChange( this, 'assetList',
					$.extend( {assetId: id}, addAssetOptions ));
			this.book.makeDirty();
			return id;
		},
		removeAsset: function(id, broadcastOptions) {
			broadcastOptions = $.extend( {
				broadcast: true
			}, broadcastOptions );
			var idx = this.p.assets.ids.indexOf( id );
			if (idx == -1)
				return PB.debugstr("removing non-exhistent asset");
			this.p.assets.ids.splice( idx, 1 );
			var assetType = this.p.assets[ id ].type;
			delete this.p.assets[id];
			if ( assetType != 'widget' )
				this.p.needReflow = true;
			PB.ModelMap.unsetResolver( id );
			// remove all dependents
			var THIS = this;
			this.p.assets.ids.filter( function(depId) {
					var asset =  THIS.p.assets[depId];
					return asset.dependentOf && asset.dependentOf.assetId == id;
				})
				.forEach(function(depId) {
					THIS.removeAsset(depId, $.extend({}, broadcastOptions, { broadcast: false }));
				});
			if (broadcastOptions.broadcast) {
				if ( assetType == 'photo' )
					this.broadcastPhotosChanged( broadcastOptions );
				PB.broadcastChange( this, 'assetList', broadcastOptions );
			}
			this.book.makeDirty();
		},
		updateAsset: function(id, newAsset, options) {
			function myExtend(src, dest) {
				var dirty = false;
				for (var prop in src) {
					switch ($.type(src[prop])) {
						case 'array':
							dest[prop] = src[prop].slice(0);
							dirty = true;
						break;
						case 'object':
							if (typeof dest[prop] !== 'object' || dest[prop] == null) {
								dirty = true;
								dest[prop] = {}
							}
							dirty = myExtend( src[prop], dest[prop] ) || dirty;
						break;
						default:
							if ( src[prop] !== dest[prop] ) {
								dest[prop] = src[prop];
								dirty = true;
							}
						break;
					}
				}
				return dirty;
			}

			options = $.extend({
				clobber: false	// clobbers all existing data
			}, options);

			if (!(id in this.p.assets))
				return PB.debugstr("Updating non-existent asset data");

			var dirty = false;

			if (options.clobber) {
				dirty = true;
				this.p.assets[id] = PB.clone(newAsset);
			}
			else
				dirty = myExtend( newAsset, this.p.assets[id] );

			// optimize: if data does not change, do not broadcast changes. Useful for manipulators
			if (dirty) {
				this.layoutInnerItem(id);
				if ( this.p.assets[id].type == 'photo' )
					this.broadcastPhotosChanged( options );
				PB.broadcastChange({id: id}, 'alldata', options);
				this.book.makeDirty();
			}
		},
				archiveSomething: function(options) {
			// creates snapshot of an asset, restore with restoreSomething
			options = $.extend( {
				type: 'type must be specified',	// 'design'|'background'|'layout'|'asset'
				assetId: null,	// when type==asset, asset to archive
				dependents: false // when type==asset, whether to archive dependents
			}, options);
			var retVal = {
				type: options.type
			};
			switch(options.type) {
				case 'design': // design archives everything
					$.extend( retVal, {
						assets: PB.clone( this.p.assets ),
						designId: this.p.designId,
						layoutId: this.p.layoutId,
						layoutData: PB.clone( this.p.layoutData ),
						backgroundId: this.p.backgroundId,
						backgroundData: this.p.backgroundData
					});
				break;
				case 'background':
					retVal.backgroundId = this.p.backgroundId;
					retVal.backgroundData = this.p.backgroundData;
				break;
				case 'layout':
					retVal.layoutId = this.p.layoutId;
					retVal.layoutData = this.p.layoutData;
				break;
				case 'asset':
					retVal.asset = PB.clone( this.p.assets[ options.assetId ] );
					retVal.assetId = options.assetId;
					if (options.dependents) {
						var depIds = this.getDependentsIds(options.assetId);
						retVal.dependents = [];
						for (var i=0; i< depIds.length; i++)
							retVal.dependents.push( {
								id: depIds[i],
								asset: PB.clone( this.p.assets[ depIds[i] ] )
							});
					}
				break;
				default:
					console.error("do not know how to archive " + options.type);
			}
			return retVal;
		},
		restoreSomething: function(archive, options) {
			var THIS = this;
			switch(archive.type) {
				case 'design':
					['assets', 'designId', 'layoutId', 'layoutData', 'backgroundId', 'backgroundData']
						.forEach( function(x) {
							THIS.p[x] = archive[x];
						});
					PB.broadcastChange(this, 'designId');
				break;
				case 'background':
					this.setBackground( archive.backgroundId, archive.backgroundData );
				break;
				case 'layout':
					this.setLayout( archive.layoutId, archive.layoutData );
				break;
				case 'asset':
					if (! this.p.assets[archive.assetId])
						this.addAsset( PB.clone(archive.asset), $.extend({}, {
								assetId: archive.assetId,
								addCaption: false
							}, options));
					else {
						this.updateAsset( archive.assetId, archive.asset, {clobber: true });
					}
					if ('dependents' in archive) {
						this.removeDependents( archive.assetId );
						for (var i=0; i< archive.dependents.length; i++) {
							var dep = archive.dependents[i];
							if (! (dep.id in this.p.assets))
								this.addAsset( dep.asset, $.extend({}, options, { assetId: dep.id}));
							else
								this.updateAsset( dep.id, dep.asset, options);
						}
					}
				break;
			}
		},
		importAssetDependents: function(archive, parentId) {
			var retVal = [];
			var THIS = this;
			if ('dependents' in archive)
				archive.dependents.forEach( function( dep) {
					var newAsset = PB.clone( dep.asset );
					newAsset.dependentOf.assetId = parentId;
					if ('top' in newAsset.css)
						delete newAsset.css.top;	// force layout
					retVal.push( THIS.addAsset(newAsset));
				});
			return retVal;
		},
		moveAsset: function( assetId, destPage, options) {
			var archive = this.archiveSomething({ type: 'asset', assetId: assetId, dependents: true });
			this.removeAsset( assetId, options);
			destPage.restoreSomething( archive, options );
		},
		getCaptionText: function( assetId ) {
			var retVal = null;
			var THIS = this;
			this.getDependentsIds( assetId ).forEach( function( depId ) {
				var dep = THIS.getAsset( depId );
				if (dep.type == 'text')
					retVal = dep.content;
			});
			return retVal;
		},
		clearPhoto: function( assetId, options) {
			options = $.extend( {
				fillerBookPhotoId: null
			}, options);
			var asset = this.getAsset( assetId );
			// replace existing photo with filler
			var replacementId;	// bookPhotoId
			if (options.fillerBookPhotoId) {
				replacementId = options.fillerBookPhotoId;
			}
			else {
				var fillerPhoto = asset.css.width > asset.css.height ?
					PB.FillerPhotos.randomH() : PB.FillerPhotos.randomV();
				replacementId = fillerPhoto.id;
			}
			var oldPhotoId = asset.photoId;
			var oldCaption = this.getCaptionText( assetId );
			// clean up asset
			asset.photoId = replacementId;
			asset.zoom = 1.0;
			delete asset.focalPoint;
			delete asset.photoRect;
			this.updateAsset( assetId, asset, { clobber: true} );
			this.removeDependents( assetId );
			if (oldCaption) {
				var oldPhoto = this.book.photo(oldPhotoId);
				oldPhoto.caption = oldCaption;
				console.log('stored caption');
			}
		},
		replacePhotoId: function( assetId, bookPhotoId, options) {
			this.clearPhoto( assetId , { fillerBookPhotoId: bookPhotoId });
			var photo = this.book.photo( bookPhotoId );
			if (photo.caption) {
				this.addAsset( {
					type: 'text',
					content: photo.caption,
					dependentOf: {
						assetId: assetId
					}
				});
			}
			else
				console.log('no caption');
		},
		removeDependents: function( assetId ) {
			var THIS = this;
			this.getDependentsIds( assetId ).forEach( function( depId ) {
				THIS.removeAsset( depId );
			});
		},
		setDesign: function( designId, options ) {
			if (this.p.designId == designId)
				return;
			this.p.designId = designId;
			this.p.layoutId = null;
			this.p.layoutData = null;
			this.p.backgroundId = null;
			this.p.backgroundData = null;
			this.p.needReflow = true;
			PB.broadcastChange( this, 'designId', options );
		},
		get designId() {
			return this.p.designId;
		},
		setLayout: function(layoutId, layoutData, options) {
			this.p.layoutId = layoutId;
			this.p.layoutData = layoutData;
			this.p.needReflow = true;
			PB.broadcastChange(this, 'layoutId', options);
		},
		setBackground: function(backgroundId, backgroundData, options) {
			this.p.backgroundId = backgroundId;
			this.p.backgroundData = backgroundData;
			PB.broadcastChange(this, 'backgroundId', options);
		},
		enclosingDom: function(options) {
			var d = this.dimensions;
			return $(document.createElement('div'))
					.addClass('design-page')
					.data('model_id', this.id);
		},
		// focal point range for images
		getFocalPointRange: function(assetId) {
			if ( !( assetId in this.p.assets ))
				return PB.debugstr("layoutInnerItem on non-existent item");
			var asset = this.p.assets[assetId];
			if (this.p.needReflow)
				return { x: { min:0, max: 100 }, y: {min:0, max:100}};
			var innerRect = new GUI.Rect(asset.css);
			if (asset.frameId) {
				innerRect = innerRect.inset(
					PB.ThemeCache.resource( asset.frameId).getInset( asset.frameData )
				);
			}
			var xdelta = innerRect.width * 100 / 2 / asset.photoRect.width;
			var ydelta = innerRect.height * 100 / 2 / asset.photoRect.height;
			return { x: { min: xdelta, max: 100 - xdelta },
					y: { min: ydelta, max: 100 - ydelta }};
		},
		layoutInnerItem: function(assetId) {
			if ( !( assetId in this.p.assets ))
				return PB.debugstr("layoutInnerItem on non-existent item");

			var asset = this.p.assets[assetId];
			switch(asset.type) {
				case 'photo':
					var innerRect = new GUI.Rect(asset.css);
					if (asset.frameId) {
						innerRect = innerRect.inset(
							PB.ThemeCache.resource( asset.frameId).getInset( asset.frameData )
						);
					}

					var zoom = Math.max( asset.zoom || 1, 1);
					var focalPoint = asset.focalPoint || { x: 50, y: 50 };

					var photo = this.book.photo( asset.photoId );

					var photoRect = new GUI.Rect( photo.dimensions );
					var scale = photoRect.fillInside( innerRect);
					photoRect = photoRect.scaleBy( scale ).scaleBy( zoom );
					photoRect = photoRect.centerIn(innerRect,
						{focalPoint: focalPoint,
							forceInside: true }).round();
					if ((typeof asset.photoRect) != 'object')
						asset.photoRect = {};
					$.extend(asset.photoRect, {
						top: photoRect.top,
						left: photoRect.left,
						width: photoRect.width,
						height: photoRect.height
					});
				break;
				case 'text':
				break;
				case 'widget':
				break;
				default:
				console.warn("not updating item inner of type ", asset.type);
				break;
			}
		},

		reflow: function() {
			// console.log('doing reflow');
			this.p.needReflow = true;
			if ( !this.p.designId )
				return;

			var THIS = this;
			var d = this.dimensions;
			var designRes = PB.ThemeCache.resource( this.p.designId );

			function syncWidgets() {
				// Delete widgets not created by user
				THIS.p.assets.ids = THIS.p.assets.ids.filter( function( assetId ) {
					var asset = THIS.p.assets[ assetId ];
					var isForeignWidget = (asset.type == 'widget') &&
						( asset.widgetCreator != 'user');
					if ( isForeignWidget ) {
						delete THIS.p.assets[ assetId ];
						return false;
					}
					else
						return true;
				});
				// If we are using a layout, no widgets are added
				if (THIS.p.layoutId)
					return;
				// Insert new widgets for design layout
				var newWidgets = ('getWidgets' in designRes) ?
					designRes.getWidgets( THIS )
					: [];
				for (var i=0; i<newWidgets.length; i++) {
					THIS.addAsset({
							type: 'widget',
							widgetId: newWidgets[i].id,
							widgetCreator: THIS.p.designId,
							widgetOptions: newWidgets[i].options
						},
						{broadcast: false}
					);
				}
			}

			function assetDesignToAsset( assetDesign, asset ) {
				asset.css = {
					top: assetDesign.top,
					left: assetDesign.left,
					width: assetDesign.width,
					height: assetDesign.height,
				};
				if ('zIndex' in assetDesign)
					asset.css.zIndex = assetDesign.zIndex;
				else {
					asset.css.zIndex =
						asset.type == 'text' ? 2 :
						asset.type == 'widget' ? 1 : 0;
				}
				asset.rotate = assetDesign.rotate || 0;
				if (assetDesign.frameId) {
					asset.frameId = assetDesign.frameId;
					asset.frameData = assetDesign.frameData;
				}
				else {
					delete asset.frameId;
					delete asset.frameData;
				}
			}

			function generateDefaultAssetDesign(asset) {
				var defaultDesign;
				if ('top' in asset)
					defaultDesign = asset;
				else {
					var center = { x: d.width / 2, y: d.height / 2 };
					var defaultWidth, defaultHeight;
					switch( asset.type ) {
						case 'text':
							defaultWidth = d.width / 3;
							defaultHeight = 30;
						break;
						case 'widget':
							var widget = PB.ThemeCache.resource( asset.widgetId );
							defaultHeight = widget.height( asset.widgetOptions );
							defaultWidth = widget.width( asset.widgetOptions );
						break;
						default:
							console.error("no assetDesing for ", asset.type);
						return;
					}
					defaultDesign = {
						top: center.y - defaultHeight / 2,
						left: center.x - defaultWidth / 2,
						width: defaultWidth,
						height: defaultHeight
					};
				}
				return defaultDesign;
			}

			// Compute layout
			var layoutRes = designRes;
			if ( this.p.layoutId != null)
				layoutRes = PB.ThemeCache.resource( this.p.layoutId );
			else
				layoutRes = designRes;

			syncWidgets();

			var layout = layoutRes.getPageLayout( this, this.p.layoutData );

			if (layout.widgets == undefined)
				layout.widgets = [];

			// Position all assets that are not children
			var captionPositioners = {}; // assetId => childPositionerId
			var defaultPositioner = 'theme://admin@core/positioners/default';

			this.p.assets.ids.forEach( function( assetId ) {
				var asset = THIS.p.assets[ assetId ];

				var assetDesign;
				if ( asset.dependentOf ) // children are positioned after parents
					return;
				switch ( asset.type ) {
					case 'photo':
						assetDesign = layout.photos.length > 0 ? layout.photos.shift() : null;
						break;
					case 'text':
						assetDesign = layout.texts.length > 0 ? layout.texts.shift() : null;
						break;
					case 'widget':
						if ( asset.widgetCreator == THIS.p.designId )
							assetDesign = layout.widgets.length > 0 ? layout.widgets.shift() : null;
						break;
					default:
						console.error('unknown asset type', asset.type );
				}
				if ( assetDesign == null )
					assetDesign = generateDefaultAssetDesign(asset);

				assetDesignToAsset( assetDesign, asset);

				captionPositioners[ assetId ] = 'captionPosition' in assetDesign ?
					assetDesign.captionPosition : defaultPositioner;

				THIS.layoutInnerItem( assetId );
			});

			// Position children
			this.p.assets.ids.forEach( function( assetId ) {
				var asset = THIS.p.assets[ assetId ];
				if ( !asset.dependentOf )
					return;
				if (! captionPositioners[ asset.dependentOf.assetId ] ) {
					console.warn('dependent asset with no parent');
					return;
				}
				var positioner = PB.ThemeCache.resource(
					captionPositioners[ asset.dependentOf.assetId ]);
				var assetDesign = positioner.getPosition( THIS, assetId );
				assetDesignToAsset( assetDesign, asset );
			});

			if (! this.p.backgroundId ) {
				this.p.backgroundId = designRes.getBackgroundId( d.width, d.height );
				this.p.backgroundData = null;
			}

			this.p.needReflow = false;

		},
		generateBackgroundDom: function(options) {
			var $div = $( document.createElement('div') )
				.addClass('design-background');
			PB.ThemeCache.resource( this.p.backgroundId ).fillBackground( $div, this.p.backgroundData, options );
			return $div;
		},
		generateFrame: function(asset, options) {
			var innerBounds = new GUI.Rect({width: asset.css.width, height: asset.css.height});
			var frame = $(document.createElement('div'))
				.addClass('design-frame')
				.css({
					width: asset.css.width,
					height: asset.css.height
				});

			if (!asset.frameId) {
				return { frame: frame, innerBounds: innerBounds};
			}
			var frameRes = PB.ThemeCache.resource( asset.frameId );
			innerBounds = innerBounds.inset( frameRes.getInset( asset.frameData ) );
			frameRes.fillFrame( frame, asset.frameData, options );
			return { frame: frame, innerBounds: innerBounds};
		},
		/*
			widgetDom
			div.design-widget tlwh	// photo with frame
				div.design-widget-frame top: 0, left: 0, width: height:
				div.design-widget-inner top: left: width: height: // widget, no overflow, position absolute
		*/
		generateWidgetDom: function( asset, options) {

			var widgetDom = $(document.createElement('div'))
				.addClass('design-widget')
				.css( asset.css );
			var fr = this.generateFrame(asset, options);
			var innerFrame = fr.innerBounds;
			if (fr.frame)
				widgetDom.append( fr.frame );

			var widget = PB.ThemeCache.resource( asset.widgetId );
			var innerDom = widget.generateDom( innerFrame.width, innerFrame.height, asset.widgetOptions)
				.addClass( 'design-widget-inner' )
				.css( {
					top: innerFrame.top,
					left: innerFrame.left,
					width: innerFrame.width,
					height: innerFrame.height
				});
			widgetDom.append( innerDom );
			return widgetDom;
		},
		getText: function(asset) {
			if (((typeof asset.content) == 'string') && asset.content != '')
				return asset.content;
			else
				return undefined;
		},
		/* textDom
			div.design-text tlwh
				div.design-frame
				div.design-text-content
		*/
		getDummyText: function(asset) {
			if (asset.dependentOf)
				return "Type your caption here";
			else
				return "Type your text here";
		},
		generateTextDom: function(asset, options) {
			// measure height of the text
			var textRect = {
				top: asset.css.top,
				left: asset.css.left,
				width: asset.css.width,
				height: 'auto'
			};

			var inset = [0,0,0,0];

			if ( asset.frameId )
				inset = PB.ThemeCache.resource( asset.frameId ).getInset( asset.frameData );

			textRect.width -= inset[1] + inset[3];

			var originalText = this.getText( asset );
			var text = originalText || this.getDummyText( asset );

			var measureText = $(document.createElement('div'))
				.addClass('design-text-content')
				.css ( textRect )
				.text( text );
			var heights = GUI.Util.getTextHeight(measureText);

			// resize asset to just fit the text
			asset.css.height = heights.divheight + inset[0] + inset[2];

			var textDom = $(document.createElement('div'))
				.addClass('design-text')
				.css ( asset.css );
			var fr = this.generateFrame(asset, options);
			var innerFrame = fr.innerBounds;
			if (fr.frame)
				textDom.append(fr.frame);

			var contentDom = $(document.createElement('div'))
				.addClass('design-text-content')
				.css({
					top:innerFrame.top,
					left: innerFrame.left,
					width: innerFrame.width,
					height: innerFrame.height
				})
				.text( text );
			if (originalText == null)
				contentDom.css('color', '#999');
			textDom.append( contentDom );
			return textDom;
		},
		/*
			photoDom
			div.design-photo tlwh	// photo with frame
				div.design-photo-frame top: 0, left: 0, width: height:
				div.design-photo-inner top: left: width: height: // photo enclosure, no overflow, position absolute
					img.design-photo-img top: left: width: height: // just photo
		*/
		generatePhotoDom: function(asset, options) {
			var photoDom = $(document.createElement('div'))
				.addClass('design-photo')
				.css( asset.css );
			var fr = this.generateFrame(asset, options);
			var innerFrame = fr.innerBounds;
			if (fr.frame)
				photoDom.append( fr.frame );
			var innerDom = $( document.createElement('div') )
				.addClass( 'design-photo-inner' )
				.css( {
					top: innerFrame.top,
					left: innerFrame.left,
					width: innerFrame.width,
					height: innerFrame.height
				});
			var imgDom = $( document.createElement('img') )
				.addClass('design-photo-img')
				.prop('src', this.book.photo( asset.photoId).getUrl(options.resolution) )
				.css({
					top: asset.photoRect.top,
					left: asset.photoRect.left,
					width: asset.photoRect.width,
					height: asset.photoRect.height
				});
			photoDom.append( innerDom.append( imgDom ) );
			return photoDom;
		},
		/*
		.design-book-page-left
			.design-page, css transform(scale), width, height
				.design-background
				.design-photo
				.design-text
		*/
		generateDom: function(options) {
			options = $.extend({
				syncable: false,	// sync dom to changes
				editable: false,	// expose edit ui
				enclosingDom: null,	// old dom to
				resolution: PB.PhotoProxy.MEDIUM
			}, options);
			var $encloseDom = options.enclosingDom || this.enclosingDom( options );
			var d = this.dimensions;
			$encloseDom.css({
				width: d.width,
				height: d.height
			});
			function insertAfterHelper($parent, $target,  $element) {
				if ($target == null)
					$parent.prepend( $element );
				else
					$element.insertAfter( $target );
			};
			if (this.p.needReflow)
				this.reflow();

			if (!this.p.needReflow)
			{
				if ( options.editable && !$encloseDom.data('pb-droppable')) {
					$encloseDom.addClass('pb-droppable')
						.data('pb-droppable', PB.Page.Editor.Droppable.Page);
				}
				// generate all parts of the page
				// this routine is also used to refresh parts of the page
				// if old enclosing dom is passed in with parts removed, only the missing parts are regenerated
				var $nextDomSlot = null;
				if (this.p.backgroundId) {
					var $background = $encloseDom.find('.design-background');
					if ( $background.length == 0 ) {
						$background = this.generateBackgroundDom( options );
						insertAfterHelper( $encloseDom, $nextDomSlot, $background );
					}
					$nextDomSlot = $background;
				}
				for (var i=0; i < this.p.assets.ids.length; i++) {
					var assetId = this.p.assets.ids[i];
					var asset = this.p.assets[ assetId ];
					var $itemDom = $encloseDom.find('*:data("model_id=' + assetId + '")');
					if ( $itemDom.length != 0 ) {
						$nextDomSlot = $itemDom;
						continue;
					}
					switch( asset.type ) {
						case 'photo':
							$itemDom = this.generatePhotoDom( asset, options );
							break;
						case 'text':
							$itemDom = this.generateTextDom( asset, options );
							break;
						case 'widget':
							$itemDom = this.generateWidgetDom( asset, options );
							break;
						default:
							debugger;
					}
					if (asset.rotate)
						$itemDom.css('transform', 'rotate(' + asset.rotate + 'deg)');

					insertAfterHelper( $encloseDom, $nextDomSlot, $itemDom );
					$nextDomSlot = $itemDom;

					if (options.editable || options.syncable)
						$itemDom.data( 'model_id', assetId );
					if (options.editable)
						this.makeEditable( asset, $itemDom );
					if (options.syncable)
						this.makeItemSyncable( this, $itemDom, options );
				}
			}
			else
				$encloseDom.text("Design not available." + this.p.assets.ids.length + " items on this page");
			if ( options.editable && !options.enclosingDom) {
				$encloseDom.on( 'touchstart mousedown', function(ev) {
					PageSelection.findClosest($encloseDom).setSelection();
				});
				PageSelection.bindToDom( this, $encloseDom )
			}
			if (options.editable) {
				PageSelection.findClosest($encloseDom).relayout();
			}
			if ( options.syncable && !options.enclosingDom )
				this.makePageSyncable( $encloseDom, options );
			return $encloseDom;
		}
	};


	['getEditMenu',
		'dom',
		'addItem',
		'removeItem',
		'allItems',
		'itemsByType',
		'item',
		'photos'
		].forEach(
		function(name) {
			PageProxy.prototype[name] = function() {
				console.error("Removed function called", name);
				debugger;
			}
		});

	PageProxy.blank = function(book) {

		return {
			id: book.generateId(),
			assets: {
				ids: []
			},
			backgroundId: null,
			backgroundData: null,
			dimensions: book.getPageDimensions('page'),
			layoutId: null,
			layoutData: null,
			needReflow: true
		}
	};


	var PageProxyEditable = {
		// callback, 'this' points to an HTMLElement, not page
		selectItem: function(pageSelection, assetId) {
			var pageAsset = PB.ModelMap.model(assetId);
			var multiTap = pageSelection.selection.some(function(val) { return val == assetId; });
			var commandSet;
			switch(pageAsset.asset.type) {
				case 'photo':
					commandSet = PB.Page.Commands.makeCommandSet(
						['move', 'pan', 'zoom', 'resize', 'rotate', 'remove','caption']
					);
				break;
				case 'text':
					commandSet = PB.Page.Commands.makeCommandSet(
						['editText', 'move', 'resizeHorizontal', 'rotate', 'remove']
					);
					if (multiTap)
						window.setTimeout(function() {
							var cmd = commandSet.getCommandById('editText');
							cmd.action( pageSelection.dom, assetId );
						}, 0);
				break;
				case 'widget':
					commandSet = PB.Page.Commands.makeCommandSet(
						['move', 'resizeFixAspect', 'rotate', 'remove']
					);
				break;
				default:
					console.warn("No menus available over items of type", pageAsset.asset.type);
			}
			pageSelection.setSelection( assetId, commandSet );
		},
		// selectItem: function($itemDom) {
		// 	console.log("wanna menu");
		// 	var $itemDom = $( ev.currentTarget );
		// 	var assetId = $itemDom.data( 'model_id' );
		// 	var pageSelection = PageSelection.findClosest( $itemDom );
		// 	this.selectItem( pageSelection, assetId, $itemDom );
		// },
		makeEditable: function(item, $itemDom) {
			var THIS = this;
			if (item.type == 'photo') {
				$itemDom.addClass('pb-droppable')
					.data('pb-droppable', PB.Page.Editor.Droppable.Photo);
				$itemDom.addClass('pb-draggable')
					.data('pb-draggable', new GUI.Dnd.Draggable(
						PB.Page.Editor.DraggableOptions.PhotoInPage ));
				$itemDom.on('mousedown.dnd touchstart.dnd', GUI.Dnd.Dnd.dragStart);
				GUI.Dnd.Util.preventDefaultDrag($itemDom);
			}
			$itemDom.on('mousedown.select touchstart.select', function(ev) {
				THIS.selectItem( PageSelection.findClosest( $itemDom ),
								$itemDom.data('model_id'),
								$itemDom);
				ev.stopPropagation();
			 });
		},
		makeItemSyncable: function(page, $itemDom, options) {
			$itemDom.on( PB.MODEL_CHANGED, function( ev, model, prop, eventOptions ) {
				var $pageDom = $itemDom.parents( '.design-page' );
				$itemDom.remove();
				page.generateDom($.extend( {}, eventOptions, options,
						{enclosingDom: $pageDom }
						));
				PageSelection.findClosest($pageDom).highlight();
				ev.stopPropagation();
			});
		},
		makePageSyncable: function($pageDom, options) {
			$pageDom.data( 'model_id', this.id );
			var THIS = this;
			$pageDom.on( PB.MODEL_CHANGED, function( ev, model, prop, eventOptions ) {
				switch( prop ) {
					case 'backgroundId':
						$pageDom.find('.design-background').remove();
						THIS.generateDom(
							$.extend( {}, eventOptions, options, {enclosingDom: $pageDom} ));
						break;
					case 'assetList':
					case 'layoutId':
						var pageSelection = PageSelection.findClosest($pageDom);
						pageSelection.setSelection();
						$pageDom.children().remove();
						THIS.generateDom(
							$.extend( {}, eventOptions, options, {enclosingDom: $pageDom} ));
						if (eventOptions && eventOptions.assetId) {
							THIS.selectItem( pageSelection, eventOptions.assetId );
						}
						break;
					case 'designId':
						var pageSelection = PageSelection.findClosest($pageDom);
						pageSelection.setSelection();
						$pageDom.children().remove();
						THIS.generateDom(
							$.extend( {}, eventOptions, options, {enclosingDom: $pageDom} ));
						break;
					case 'dimensions':
						$pageDom.children().remove();
						THIS.generateDom(
							$.extend( {}, eventOptions, options, {enclosingDom: $pageDom} ));
						break;
					default:
						console.warn("how should I sync ", prop);
						break;
				};
			});
		}
	};

	// Special event fires when dom element has been removed
	// The only documentation I've found for jQuery special events
	// http://benalman.com/news/2010/03/jquery-special-events/

	$.event.special.pageRemoved = {
		remove: function( handleObj ) {
			var sel = $(this).data('page-selection');
			if (sel)
				sel.setSelection();
			return false;
		}
	}
	$.extend(PageProxy.prototype, PageProxyEditable);

	var PageSelection = function(page, dom) {
		this.page = page;
		this.dom = dom;
		this.selection = [];	// array of asset ids
		this.manipulator = null;
		this.commandSet = null;
		this.selectTime = Date.now();
	};
	PageSelection.prototype = {
		setSelection: function(assetId, commandSet) {
			this.selectTime = Date.now();
			var newSelection = assetId ? [assetId] : [];
			if (newSelection.toString() == this.selection.toString())
				return;
			this.selection = newSelection;
			this.highlight();
			// hide manipulator if from another item
			if (this.manipulator && this.manipulator.assetId != assetId)
			 	this.setManipulator(null);
			// if ($popup != null && $popup.length == 0)
			// 	$popup = null;
			this.commandSet = commandSet;
			this.broadcast('selection', this.selection);
		},

		highlight: function() {
			this.dom.find('.selected').removeClass('selected');
			for (var i=0; i<this.selection.length; i++)
				this.dom.find('*:data("model_id=' + this.selection[i] + '")').addClass('selected');
		},
		setManipulator: function(manipulator) {
			if (this.manipulator)
				this.manipulator.remove();
			this.manipulator = manipulator;
			if (this.manipulator)
				this.manipulator.show();
		},
		relayout: function() {
			if (this.manipulator)
				this.manipulator.reposition(this.dom);
		},
		store: function() {
			var retVal = {
				selection: this.selection,
				manipulator: this.manipulator,
				commandSet: this.commandSet
			};
			this.manipulator = null;
			return retVal;
		},
		restore: function(state) {
			// restores selection stored with save
			this.setSelection(
				state.selection.length > 0 ? state.selection[0] : null, state.commandSet);
			this.manipulator = state.manipulator;
			this.relayout();
		}
	};

	$.extend( PageSelection.prototype, PB.ListenerMixin);

	$.extend( PageSelection, {
		bindToDom: function(page, $dom) {
			var sel = $dom.data('page-selection');
			if (sel) {
				debugger;
				sel.highlight();
			}
			else {
				sel = new PageSelection(page, $dom);
				$dom.data('page-selection', sel);
				$dom.on('pageRemoved', this, function() {
					var sel = $(this).data('page-selection');
					if (sel)
						sel.setSelection();
				});
			}
			return sel;
		},
		findClosest: function($dom) {
			var ps = $dom.data('page-selection') ||
				$dom.parents( '*:data("pageSelection")' ).data('page-selection');
			if (ps == null) {
				console.error("could not find pageselection in ", $dom);
				throw new Error("Could not find pageselection");
			}
			return ps;
		},
		// return [PageSelection]
		getActiveSelections: function() {
			var retVal = [];
			$('.selected').each(function() {
				var s = PageSelection.findClosest($(this));
				if (s)
					retVal.push(s);
			});
			return retVal;
		},
		forEach: function(callback) {
			// callback(PB.PageProxy, assetId)
			this.getActiveSelections()
				.forEach( function( pageSel ) {
					pageSel.selection.forEach( function( assetId ) {
						callback(pageSel.page, assetId, pageSel);
					});
				});
		},
		clear: function() {
			PageSelection.getActiveSelections().forEach( function( sel ) {
				sel.setSelection();
			});
		}
	});

	scope.Page = {
		Proxy: PageProxy,
		Selection: PageSelection
	}
})(PB);

