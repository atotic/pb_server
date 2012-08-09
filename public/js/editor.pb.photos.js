// editor.pb.photos.js

(function(scope) {


	var cache = {};
	var tempPrefix = 'temp-';

	var ServerPhotoCache = {
		get: function(id) {
			if (id in cache)
				return cache[id];
			else {
				cache[id] = new ServerPhoto(id);
				cache[id].load();
				return cache[id];
			}
		},
		replaceTempId: function(photo, newId) {
			delete cache[photo.id];
			photo._id = newId;
			if (! newId in cache)
				cache[newId] = photo;
			else
				console.log('duplicate photo detection');
		},
		createFromLocalFile: function(file) {
			var id = tempPrefix + PB.randomString(5);
			cache[id] = new ServerPhoto(id);
			cache[id].uploadLocalFile(file);
			return cache[id];
		}
	}

	var ServerPhoto = function(id) {
		if (!id)
			throw "ServerPhoto must have an id";
		this._id = id;
		this._status = "";
		this._progress = 0;
	}

/*
 * ServerPhoto represents photo stored on server (PB::Photo class)
 * Functionality:
 * - objects last forever, and are stored in the cache
 * - objects can be patched, and patches are broadcast to modelref
 * - modelref
 */
	ServerPhoto.prototype = {
		get id() {
			return this._id;
		},
		set status(msg) {
			this._status = msg;
			PB.broadcastChange(this, 'status');
		},
		get status() {
			return this._status;
		},
		get progress() {
			return this._progress;
		},
		set progress(percent) {
			this._progress = percent;
			PB.broadcastChange(this, 'progress');
		},
		set locked(val) {
			this._locked = true;
		},
		get originalUrl() {
			if ('original_url' in this)
				return this.original_url;
			else
				return this._getDataUrl();
		},
		get displayUrl() {
			if ('display_url' in this)
				return this.display_url;
			else
				return this._getDataUrl();
		},
		get iconUrl() {
			if ('icon_url' in this)
				return this.icon_url;
			else
				return this._getDataUrl();
		},
		_getDataUrl: function() {
			if (this._dataUrl)
				return this._dataUrl;
			else {
				this._createDataUrl();
				return '/img/surprise.png';
			}
		},
		_setDataUrl: function(url) {
			if ('display_url' in this)
				return;	// do not need data if we have real urls
			this._dataUrl = url;
			PB.broadcastChange(this, 'icon_url');
			PB.broadcastChange(this, 'display_url');
			PB.broadcastChange(this, 'original_url');
		},
		_createDataUrl: function() {
			if (!('_localFile' in this))
				return;
			var fileUrl;
			if ('URL' in window)
				fileUrl = window.URL.createObjectURL(this._localFile);
			else if ('webkitURL' in window)
				fileUrl = window.webkitURL.createObjectURL(this._localFile);
			if (!fileUrl) {
				console.log("could not create fileUrl");
				return;
			}
			var img = new Image();
			var THIS = this;
			$(img).on({
				load: function() {
					// TODO: convert to scale
					var desiredHeight = 512;
					var scale = desiredHeight / img.naturalHeight;
					if (scale > 1)
						scale = 1;
					var canvasWidth = Math.round(img.naturalWidth * scale);
					var canvasHeight = Math.round(img.naturalHeight*scale);
					var canvas = $("<canvas />")
						.attr('width', canvasWidth)
						.attr('height', canvasHeight)
						.get(0);
					canvas.getContext('2d').drawImage(img, 0,0, canvasWidth, canvasHeight);
					THIS._setDataUrl( canvas.toDataURL('image/jpeg'));
					// cleanup
					$(img).unbind();
					img.src = null;
					if ('URL' in window)
						window.URL.revokeObjectURL(fileUrl);
					else if ('webkitURL' in window)
						window.webkitURL.revokeObjectURL(fileUrl);
				},
				error: function() {
					console.log("Unexpected error loading local image");
				}
			});
			img.src = fileUrl;
		},
		_generatePlaceholder: function(width, height, options) {
			return '/img/surprise.png';
		},
		uploadLocalFile: function(file) {
			this._localFile = file;
			console.log("uploadLocalFile");
			PB.Uploader.savePhoto(this);
		},
		load: function() {
			var THIS = this;
			this.status = 'Loading';
			$.ajax('/photo/'+ this.id + "?size=json")
				.done(function(response, msg, jqXHR) {
					THIS.status = "";
					THIS.loadFromJson(response);
				})
				.fail(function(jsXHR, status, msg) {
					if (jsXHR.status == 404) {
						THIS.status = "Failed. Not found";
						THIS.locked = true;
					}
					else {
						THIS.status = "Retrying";
						PB.NetworkErrorRetry.retryLater();
						window.setTimeout(function() { THIS.load()}, PB.NetworkErrorRetry.nextRetryInterval);
					}
				});
		},
		// When temporary id changes, change is broadcast to all the listeners
		// with options {newId: new_value}. Listeners should reregister their interest
		loadFromJson: function(json) {
			if ('id' in json && this.id != json.id) {
				if (!/^temp/.exec(this.id))
					throw "Photo id is immutable once assigned (unless temp id)";
				PB.broadcastChange(this, 'id', {newId: json.id});
				ServerPhotoCache.replaceTempId(this, json.id);
			}
			var props = ['original_url', 'display_url', 'icon_url', 'exif', 'display_name'];
			for (var i=0; i<props.length; i++)
				if ( (!(props[i] in this))
						 || ( (props[i] in this) && this[props[i]] != json[props[i]])) {
					this[props[i]] = json[props[i]];
					PB.broadcastChange(this, props[i]);
				}
			if ('display_url' in this)	// clean up generated image
				delete this._dataUrl;
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
			this.status = 'uploading';
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
						THIS.progress = evt.lengthComputable ? evt.loaded * 100 / evt.total : -1;
						}, false);
					return x;
				}
			});
			xhr.fail( function(jqXHR, textStatus, message) {
				THIS.saveError = textStatus;
				console.log("xhr.fail ServerPhoto")
				switch (jqXHR.status) {
					case 413:
					// TODO, remove too large from picture list, with nice error.
					// show the photos inside an alert
						THIS.status = "Upload failed. File is too big.";
						THIS.progress = 0;
						THIS.locked = true;
						break;
					default:
						THIS.progress = 0;
						THIS.status = "Upload failed. Retrying.";
						PB.Uploader.savePhoto(THIS); // retry
						break;
				}
			}).done( function(response, msg, jqXHR) {
				THIS.status = "";
				THIS.progress = 0;
				THIS.loadFromJson(response);
				delete THIS._localFile;
			});
			return xhr;
		}
	}
	scope.ServerPhotoCache = ServerPhotoCache;
})(PB);
