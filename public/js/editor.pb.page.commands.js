// editor.pb.page.commands.js

(function(scope) {
	var Commands = {
		getManipulatorCommandSet: function() {
			if ('cmdSet' in this)
				return this.cmdSet;
			this.cmdSet = new GUI.CommandSet('manipulators');

			this.cmdSet.add( new GUI.Command ({
				id: 'move',
				title: 'move',
				icon: 'move',
				action: function( $pageDom, assetId ) {
					var m = new GUI.Manipulators.Move( $pageDom, assetId );
					PageSelection.findClosest( $pageDom ).setManipulator( m );
				}
			}));
			this.cmdSet.add( new GUI.Command({
				id: 'pan',
				title: 'pan',
				icon: 'hand-up',
				action: function( $pageDom, assetId) {
					var m = new GUI.Manipulators.Pan( $pageDom, assetId );
					PageSelection.findClosest( $pageDom ).setManipulator( m );
				}
			}));
			this.cmdSet.add( new GUI.Command({
				id: 'zoom',
				title: 'zoom',
				icon: 'search',
				action: function( $pageDom, assetId) {
					var m = new GUI.Manipulators.Zoom( $pageDom, assetId );
					PageSelection.findClosest( $pageDom ).setManipulator( m );
				}
			}));
			this.cmdSet.add( new GUI.Command({
				id: 'resize',
				title: 'resize',
				icon: 'arrow-up',
				action: function( $pageDom, assetId) {
					var m = new GUI.Manipulators.Resize( $pageDom, assetId );
					PageSelection.findClosest( $pageDom ).setManipulator( m );
				}
			}));
			this.cmdSet.add( new GUI.Command({
				id: 'resizeHorizontal',
				title: 'resize',
				icon: 'arrow-up',
				action: function( $pageDom, assetId) {
					var m = new GUI.Manipulators.Resize( $pageDom, assetId ,{ vertical: false });
					PageSelection.findClosest( $pageDom ).setManipulator( m );
				}
			}));
			this.cmdSet.add( new GUI.Command({
				id: 'resizeFixAspect',
				title: 'resize',
				icon: 'arrow-up',
				action: function( $pageDom, assetId) {
					var m = new GUI.Manipulators.Resize( $pageDom, assetId ,{ fixAspect: true });
					PageSelection.findClosest( $pageDom ).setManipulator( m );
				}
			}));
			this.cmdSet.add( new GUI.Command({
				id: 'rotate',
				title: 'rotate',
				icon: 'repeat',
				action: function( $pageDom, assetId) {
					var m = new GUI.Manipulators.Rotate( $pageDom, assetId );
					PageSelection.findClosest( $pageDom ).setManipulator( m );
				}
			}));
			this.cmdSet.add( new GUI.Command({
				id: 'editText',
				title: 'edit',
				icon: 'edit',
				action: function( $pageDom, assetId) {
					var m = new GUI.Manipulators.EditText( $pageDom, assetId );
					PageSelection.findClosest( $pageDom ).setManipulator( m );
				}
			}));
			this.cmdSet.add( new GUI.Command({
				id: 'remove',
				title: 'remove',
				icon: 'remove',
				key: GUI.CommandManager.keys.backspace,
				action: function($pageDom, assetId) {
					// when deletekey is pressed, $pageDom and itId are null
					PageSelection.forEach(function( page, assetId, pageSelection) {
						if ($pageDom != null || pageSelection.manipulator == null) {
							pageSelection.setSelection();
							page.removeAsset( assetId );
						}
					});
				}
			}));
			this.cmdSet.add( new GUI.Command( {
				id: 'caption',
				title: 'caption',
				icon: 'comment-alt',
				action: function($pageDom, photoAssetId) {
					var pageAsset = PB.ModelMap.model( photoAssetId );
					var assets = pageAsset.page.getAssets();
					var captionIds = PB.ThemeUtils.findAssetChildren(assets, photoAssetId)
						.filter( function( id ) { return assets[id].type == 'text'});
					// if caption already exist, go in edit mode
					var editId;
					if (captionIds.length > 0)
						editId = captionIds[0];
					else {
						editId = pageAsset.page.addAsset({
							type: 'text',
							dependentOf: {
								assetId: photoAssetId
							}
						});
					}
					if (editId)
						Commands.cmdSet.getCommandById( 'editText' )
							.action( $pageDom, editId);
				}
			}));
			return this.cmdSet;
		},
		makeCommandSet: function(cmdIdArray) {
			var allCommands = this.getManipulatorCommandSet();
			var retCmds = new GUI.CommandSet('photoPopup');
			cmdIdArray.forEach( function(id) {
				retCmds.add( allCommands.getCommandById( id ));
			});
			return retCmds;
		}
	}
	scope.Commands = Commands;
})(PB.Page);
