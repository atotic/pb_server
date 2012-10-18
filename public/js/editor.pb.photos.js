// editor.pb.photos.js


// PB.PhotoProxy
(function(scope) {

	// See ReferenceAPI
	var PhotoProxy = function(id, book) {
		this.id = id;
		this.book = book;
	}

	PhotoProxy.SMALL = 128;
	PhotoProxy.MEDIUM = 1024;
	PhotoProxy.LARGE = 2000;

	PhotoProxy.prototype = {
		get p() {
			if (!('_serverPhoto' in this))
				this._serverPhoto = PB.ServerPhotoCache.get(this.id);
			return this._serverPhoto;
		},
		getUrl: function(size) {
			if (size <= PhotoProxy.SMALL)
				return this.p.iconUrl;
			else if (size <= PhotoProxy.MEDIUM)
				return this.p.displayUrl;
			else
				return this.p.originalUrl;
		},
		get dimensions() {
			return this.p.dimensions;
		},
		isDraggable: function() {
			return true;
		},
		get status() {
			return this.p.status;
		},
		get progress() {
			return this.p.progress;
		},
		get jsDate() {
			return this.p.jsDate;
		},
		get display_name() {
			return this.p.display_name;
		},
		get faces() {
			return this.p.faces;
		}
	}

	scope.PhotoProxy = PhotoProxy;
})(window.PB);

// PB.ServerPhotoCache
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
		},
		createFromJson: function(json) {
			cache[json.id] = new ServerPhoto(json.id);
			cache[json.id].loadFromJson(json, true);
			return cache[json.id];
		},
		sortPhotos: function(photos) {
			function dateComparator(a,b) {
				var a_date = a.photo.jsDate;
				var b_date = b.photo.jsDate;
				if (a_date && b_date)
					return a_date - b_date;
				else {
					if (a_date === null) {
						if (b_date === null)
							return b.loc - a.loc;
						else
							return -1;
					}
					else
						return 1;
				}
			}
			function addedComparator(a,b) {
				return a.loc - b.loc;
			}
			function nameComparator(a,b) {
				var a_name = a.photo.display_name;
				var b_name = b.photo.display_name;
				// natural sort, if possible
				var a_match = a_name.match(/(\d+)/);
				var b_match = b_name.match(/(\d+)/);
				var a_num = a_match ? parseInt(a_match[1], 10) : NaN;
				var b_num = b_match ? parseInt(b_match[1], 10) : NaN;
				if (a_num != a_num || b_num != b_num) { // weird way of testing isNan(a_num) || isNan(b_num)
					if (a_name < b_name)
						return -1;
					else if (b_name < a_name)
						return 1;
					else
						return a.loc - b.loc;
				}
				else {
					if (a_num == b_num)
						return a.loc - b.loc;
					else
						return a_num - b_num;
				}
			}
			if (photos.length === 0)
				return photos;
			var modelArray = [];
			for (var i=0; i<photos.length; i++)
				modelArray.push({photo: PB.ServerPhotoCache.get( photos[i]), loc: i});
			var compareFn;
			switch (GUI.Options.photoSort) {
				case 'added': compareFn = addedComparator; break;
				case 'taken': compareFn = dateComparator; break;
				case 'name': compareFn = nameComparator; break;
				default: console.error("unknown compare fn for sortPhotos");break;
			}
			modelArray.sort(compareFn);
			return modelArray.map(function(a) { return a.photo.id});
		}
	}

	var ImgLoadThrottler = {
		waiting: [],
		loading: null,
		setSrc: function(img, src) {
			this.waiting.push({img: img, src: src});
			this._process();
		},
		_doneLoading: function(img) {
			$(this.loading.img).unbind();
			this.loading = null;
			window.setTimeout(function() {ImgLoadThrottler._process()}, 10);
		},
		_process: function() {
			if (this.loading != null)
				return;
			this.loading = this.waiting.shift();
			if (this.loading == null)
				return;
			$(this.loading.img).on({
				load: function() {
					ImgLoadThrottler._doneLoading();
				},
				error: function() {
					ImgLoadThrottler._doneLoading();
				},
				abort: function() {
					ImgLoadThrottler._doneLoading();
				}
			});
			this.loading.img.src = this.loading.src;
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
		SIZE_LIMIT: 10000000,	// Upload size limit

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
		get doNotSave() {
			return this._doNotSave;
		},
		set doNotSave(val) {
			this._doNotSave = val;
		},
		_localFileUrl: function() {
			if ('_fileUrl' in this)
				return this._fileUrl;
			if ('URL' in window)
				this._fileUrl = window.URL.createObjectURL(this._localFile);
			else if ('webkitURL' in window)
				this._fileUrl = window.webkitURL.createObjectURL(this._localFile);
			if (!this._fileUrl)
				console.warn("Could not create localFileUrl");
			return this._fileUrl;
		},
		revokeFileUrl: function(url) {
			if ('URL' in window)
				window.URL.revokeObjectURL(url);
			else if ('webkitURL' in window)
				window.webkitURL.revokeObjectURL(url);
		},
		get originalUrl() {
			if ('original_url' in this)
				return { url: this.original_url, width: this.original_w, height: this.original_h};
			else
				return this._getDataUrl();
		},
		get displayUrl() {
			if ('display_url' in this)
				return { url: this.display_url, width: this.display_w, height: this.display_h};
			else
				return this._getDataUrl();
		},
		get iconUrl() {
			if ('icon_url' in this)
				return { url: this.icon_url, width: this.icon_w, height: this.icon_h};
			else
				return this._getDataUrl();
		},
		get dimensions() {
			if ('original_url' in this)
				return { width: this.original_w, height: this.original_h};
			else if ('_data_natural_w' in this)
				return { width: this._data_natural_w, height: this._data_natural_h};
			else
				return { width: 1936, height: 1936};
		},
		displayName: function() {
			if ('display_name' in this)
				return this.display_name;
			else if ('_localFile' in this)
				return this._localFile.name;
			else
				return "name unknown";
		},
		get jsDate() {
			if ('_jsDate' in this)
				return this._jsDate;
			if ('date_taken' in this) {
				var match = this.date_taken.match(/(\d+):(\d+):(\d+) (\d+):(\d+):(\d+)/);
				if (match)
					try {
					this._jsDate = new Date(
						parseInt(match[1], 10),
						parseInt(match[2], 10),
						parseInt(match[3], 10),
						parseInt(match[4], 10),
						parseInt(match[5], 10),
						parseInt(match[6], 10));
				}catch(ex) {
					console.warn("error parsing date", this.date_taken);
				}
			}
			return this._jsDate;
		},
		_getDataUrl: function() {
			if (this._dataUrl)
				return { url: this._dataUrl, width: this._data_w, height: this._data_h};
			else {
				this._createDataUrl();
				return { url: '/img/surprise.png', width: 128, height: 128};
			}
		},
		_setDataUrl: function(url, width, height) {
	//		console.log("Data url set", this.id);
			this._dataUrlCreateInProgress = false;
			if ('display_url' in this)
				return;	// do not need data if we have real urls
			this._dataUrl = url;
			this._data_w = width;
			this._data_h = height;
			PB.broadcastChange(this, 'icon_url');
			PB.broadcastChange(this, 'display_url');
			PB.broadcastChange(this, 'original_url');
		},
		_setDataUrlFromImage: function(img) {
			this._dataUrlCreateInProgress = false;
			if ('display_url' in this)
				return;
			var desiredHeight = 512;
			var orientation = this._jpegFile.orientation;
			var swapAxes = orientation == 6 || orientation == 8
			var imageWidth = img.naturalWidth;
			var imageHeight = img.naturalHeight;
			var scale = Math.min(1, desiredHeight / imageHeight);
			var rot = 0;
			var trans = {x:0, y:0};
			var drawLoc = {x:0, y:0};
			var canvasWidth = imageWidth * scale;
			var canvasHeight = imageHeight * scale;

			// if loading a thumbnail, assume real image is larger
			var scale = img.naturalWidth <= 320 ? (1936 / img.naturalWidth) : 1;
			this._data_natural_w = img.naturalWidth * scale;
			this._data_natural_h = img.naturalHeight * scale;

			function swapWidthHeight() {
				var tmp = canvasWidth;
				canvasWidth = canvasHeight;
				canvasHeight = tmp;
				tmp = this._data_natural_w;
				this._data_natural_h = this._data_natural_w;
				this._data_natural_w = tmp;
			}

			switch (orientation) {
			case 1: // no rotation
				break;
			case 6:
					rot = Math.PI/2; //Math.PI /2.2;
					swapWidthHeight();
					trans = {x:canvasWidth / 2,y:canvasHeight/2};
					drawLoc = {x:-imageWidth * scale /2, y:-imageHeight * scale /2};
					break;
			case 3:
					rot = Math.PI;
					trans = {x:canvasWidth /2, y:canvasHeight /2};
					drawLoc = {x:-imageWidth * scale /2, y:-imageHeight * scale /2};
					break;
			case 8:
					rot = Math.PI * 3 / 2;
					swapWidthHeight();
					trans = {x:canvasWidth /2, y:canvasHeight /2};
					drawLoc = {x:-imageWidth * scale /2, y:-imageHeight * scale /2};
					break;
			default:
				console.warn("unknown orientation", orientation);break;
			}

			var c = $('<canvas>')
					.attr('width', canvasWidth)
					.attr('height',canvasHeight)
					.get(0);
			ctx = c.getContext('2d');
			ctx.translate(trans.x,trans.y)
			ctx.rotate(rot);
			ctx.drawImage(img,drawLoc.x,drawLoc.y, imageWidth * scale, imageHeight * scale);
			this._setDataUrl( c.toDataURL('image/jpeg'), canvasWidth, canvasHeight);
		},
		_createDataUrlFromLocalFile: function() {
			var img = new Image();
			var fileUrl = this._localFileUrl();
			if (!fileUrl)
				return;

			var THIS = this;
			img.onload = function() {
				THIS._setDataUrlFromImage(img);
				THIS.revokeFileUrl(fileUrl);

			};
			img.onerror = function() {
				THIS.revokeFileUrl(fileUrl);
				console.warn("Error loading image from local file");
			};
			ImgLoadThrottler.setSrc(img, fileUrl);
		},
		_createDataUrl: function() {
			if (!('_localFile' in this))
				return;
			if(this._dataUrlCreateInProgress)
				return;
			this._dataUrlCreateInProgress = true;
			var THIS = this;

			if (!'_jpegFile' in this) {
				console.warn("Photo._createDataUrl called without _jpegFile");
				this._createdataUrlFromLocalFile();
			}
			this._jpegFile.deferred.then(function() {
//				console.log("Exif loaded", THIS.id);
				THIS._jpegFile.readMetadata();

				var thumbDataUrl = THIS._jpegFile.thumbnail;
				if (!thumbDataUrl)
					THIS._createDataUrlFromLocalFile();
				else {
					var img = new Image();
					img.onload = function() {
						THIS._setDataUrlFromImage(img);
					};
					img.onerror = function() {
						THIS._createDataUrlFromLocalFile();
					};
					img.src = thumbDataUrl;
				}
			});
		},
		_generatePlaceholder: function(width, height, options) {
			return '/img/surprise.png';
		},
		uploadLocalFile: function(file) {
			this._localFile = file;
			this._jpegFile = new PB.JpegFile(file);
			if (this._localFile.size > this.SIZE_LIMIT) {
				GUI.Error.photoTooBig(this);
				throw "File too big";
			}
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
		loadFromJson: function(json, noBroadcast) {
			if ('id' in json && this.id != json.id) {
				if (! /^temp/.exec(this.id))
					throw "Photo id is immutable once assigned (unless temp id)";
				PB.broadcastChange(this, 'id', {newId: json.id});
				ServerPhotoCache.replaceTempId(this, json.id);
			}
			var nonBroadcastProps = ['original_w','original_h','display_w','display_h','icon_w','icon_h'];
			for (var i=0; i<nonBroadcastProps.length; i++)
				this[nonBroadcastProps[i]] = json[nonBroadcastProps[i]];

			var props = ['original_url', 'display_url', 'icon_url', 'display_name', 'date_taken', 'caption','faces'];
			for (var i=0; i<props.length; i++)
				if ( (!(props[i] in this))
						 || ( (props[i] in this) && this[props[i]] != json[props[i]])) {
					this[props[i]] = json[props[i]];
					if (!noBroadcast)
						PB.broadcastChange(this, props[i]);
				}
			'exif'
			if ('display_url' in this)	// clean up generated image
				delete this._dataUrl;
		},
		set saveProgress(val) {
//			console.log("saveProgress " + val);
			this._saveProgress = val;
		},
		set saveError(val) {
			console.log("saveError " + val);
		},
		getSaveDeferred: function() {
			if (this._localFile === null)
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
						GUI.Error.photoTooBig(THIS);
						THIS.status = "Upload failed. File is too big.";
						THIS.progress = 0;
						THIS._doNotSave = true;
						break;
					default:
						THIS.progress = 0;
						THIS.status = "Upload failed. Retrying.";
						if(!THIS._doNotSave)
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
