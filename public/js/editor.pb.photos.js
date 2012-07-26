// editor.pb.photos.js

(function(scope) {


	var ServerPhoto = function(id) {
		this._id = id;
		this._modelref = null;
	}

	var serverPhotoCache = {};

	function storeInCache(photo) {
		// newly saved photos get stored in cache once their id arrives
		if (!photo.id)
			throw "storing photo without an id!"
		if (photo.id in serverPhotoCache)
			return;	// drop it, already in the cache
		else
			serverPhotoCache[photo.id] = photo;
	}

	// returns the photo
	ServerPhoto.get = function(id) {
		if (id in serverPhotoCache)
			return serverPhotoCache[id];
		else {
			serverPhotoCache[id] = new ServerPhoto(id);
			serverPhotoCache[id].load();
		}
	}

	ServerPhoto.createFromLocalFile = function(file) {
		var photo = new ServerPhoto();
		photo.uploadLocalFile(file);
	}

/*
 * ServerPhoto represents photo stored on server (PB::Photo class)
 * Functionality:
 * - objects last forever, and are stored in the cache
 * - objects can be patched, and patches are broadcast to modelref
 * - modelref
 * Works:
 * - image loading
 */
	ServerPhoto.prototype = {
		bindToModel: function(modelref) {
			this._modelref = modelref;
		},
		broadcastChange: function(prop) {
			// TODO
		},
		set status(msg) {
			this._status = msg;
			this.broadcastChange('originalUrl');
			this.broadcastChange('displayUrl');
		},
		set locked(val) {
			this.locked = true;
		},
		get originalUrl() {
			if ('original_url' in this)
				return this.original_url;
			else
				debugger; // TODO
		},
		get displayUrl() {

		},
		get iconUrl() {

		},
		uploadLocalFile: function(file) {
			this._localFile = file;
			console.log("uploadLocalFile");
			PB.Uploader.savePhoto(this);
		},
		load: function() {
			var THIS = this;
			$.ajax('/photo/'+ this.id + "?size=json")
				.done(function(response, msg, jqXHR) {
					THIS.loadFromJson(response);
				})
				.fail(function(response, msg, jsXHR) {
					if (jsXHR.status == 404) {
						this.status = "Not found";
						this.locked = true;
					}
					else {
						PB.status("network error");
						PB.NetworkErrorRetry.retryLater();
						window.setTimeout(function() { THIS.load()}, PB.NetworkErrorRetry.nextRetryInterval);
					}
				});
		},
		loadFromJson: function(json) {
			if ('id' in this && this.id)
				if ('id' in json && this.id != id.json)
					throw "Photo id is immutable once assigned";
			var props = ['id', 'original_url', 'display_url', 'icon_url', 'exif', 'display_name'];
			for (var i=0; i<props.length; i++)
				if ( (!(props[i] in this))
						 || ( (props[i] in this) && this[props[i]] != json[props[i]])) {
					this[props[i]] = json[props[i]]
					this.broadcastChange(props[i])
				}
		},
		set saveProgress(val) {
			console.log("saveProgress " + val);
			this._saveProgress = val;
		},
		set saveError(val) {
			console.log("saveError " + val);
		},
		getSaveDeferred: function() {
			if (this._localFile == null)
				return null;
			var fd = new FormData();
			fd.append('display_name', this._localFile.name);
			fd.append('photo_file', this._localFile);
			var THIS = this;
			var xhr = $.ajax({
				url: "/photos?book=" + PB.Book.default.id,
				type: "POST",
				data: fd,
				processData: false,
				contentType: false,
				xhr: function() {	// create a listener for upload events
					var x = new window.XMLHttpRequest();
					x.upload.addEventListener("progress", function(evt) {
						THIS.saveProgress = evt.lengthComputable ? evt.loaded * 100 / evt.total : -1;
						}, false);
					return x;
				}
			});
			xhr.fail( function(jqXHR, textStatus, message) {
				THIS.saveError = textStatus;
				console.log("xhr.fail ServerPhoto")
				PB.Uploader.savePhoto(THIS); // retry
			}).done( function(response, msg, jqXHR) {
				THIS.loadFromJson(response);
			});
		}
	}

	scope.ServerPhoto = ServerPhoto;

})(PB);
