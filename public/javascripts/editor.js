"use strict"; // could not do it with jResig 

// Debug only, shows all event handlers
function visualEvent(){ 
	if (typeof VisualEvent!='undefined') { 
		if (document.getElementById('Event_display')) {
			VisualEvent.fnClose();
		}
		else {
			VisualEvent.fnInit();
		}
	}
	else
	{
		var n=document.createElement('script');
		n.setAttribute('language','JavaScript');
		n.setAttribute('src','http://www.sprymedia.co.uk/design/event/media/js/event-loader.js');
		document.body.appendChild(n);
	}
}
// jQuery extensions
(function(jQuery){

/*
 * reflowVisible  
 * Solves the problem of "cannot reflow an hidden element because hidden elements have no dimensions"
 It takes a reflow function, and calls it:
 * a) immediately if element is visible
 * b) before element will be shown, if element is hidden
 * usage: 
 * $().reflowVisible() 
 *   call this after show();
 * $().reflowVisible( function(immediate)) sets the reflow function
 *   this is the $(element shown), immediate if the reflow function is immediate (animate here)
 */
	jQuery.fn.reflowVisible = function(reflow) {
		this.each(function() {
			if (reflow)
				$(this).data('reflow-visible', reflow);
			var visible = $(this).is(':visible');
			var immediate = visible && reflow != undefined
			if (!reflow || visible) {
				var cb = $(this).data('reflow-visible');
				if (!cb)
					return;
				var showHelper = new PB.ShowForMeasure(this);
//				console.log('reflow performed ' + immediate);
				showHelper.startMeasure();
				try {
					cb.apply(this, [immediate]);
				} 
				catch (e) {
					console.log("exception in reflow callback");
				}
				showHelper.endMeasure();
				$(this).removeData('reflow-visible');
			}
//			else
//				console.log('reflow postponed');
		});
	};
/*
 * Sliders scroll by making left margin negative
 * This code will reveal the child element by fixing the margin
 */
	jQuery.fn.revealByMarginLeft = function(childFilter, animate) {
		var child = this.contents().filter(childFilter);
		if (child.size() == 0) {
			console.warn("No child to reveal");
			return;
		}
		var lastChild = this.children().last();
		var rightmostEdge = lastChild.position().left + lastChild.outerWidth() 
				+ Math.abs(parseInt(this.css("margin-left")));
		// Limit scrolling to now show empty space on the right
		var leftLimit = rightmostEdge - this.parent().width();
		leftLimit = Math.max(0, leftLimit);
		
		var left = child.position().left + Math.abs(parseInt(this.css("margin-left")));
		if (left > leftLimit)
			left = leftLimit;
		this.clearQueue().animate({ 
			"margin-left": "-" + Math.abs(left) + "px"
			}, {
				duration: 200
			});	
	};
	
	// Creates a "flippy" UI element
	// state: 'open'|'closed'
	// flippyContent: content to show when flippy opens
	// clickEl: element that accepts the click, defaults to flippy
	jQuery.fn.flippy = function(state, flippyContent, clickEl) {
		if (this.length == 0)
			return;
		var flippy = $(this[0]);
		// set up initial conditions
		flippy.addClass('flippy');
		flippy.attr('state', state);
		if (state == 'open')
			flippyContent.show();
		else
			flippyContent.hide();
		clickEl = clickEl.length == 0 ? flippy : clickEl[0]
		// click toggles the state
		$(clickEl).click( function(e) {
			var timing = 100;
			if (flippy.attr('state') == 'closed') {
				flippy.attr('state', 'open');
				flippyContent.show();	// FIXME jQuery bug, does not hide when has timing
			}
			else {
				flippy.attr('state', 'closed');
				flippyContent.hide();
			}
			PB.UI.MainContainer.resize();
			e.stopPropagation();
			e.preventDefault();
		})
		.css("cursor", "pointer");
		return this;
	};
	jQuery.browserCssPrefix = 
	jQuery.browser.webkit ? '-webkit-' :
	jQuery.browser.mozilla ? '-moz-' :
	jQuery.browser.opera ? '-o-' :
	jQuery.browser.msie ? '-ms-' :
  '-webkit-';
	
})(window.jQuery);

// Timer utility class
PB.Timer = function(name) {
	this.startMili = Date.now();
	this.endMili = this.startMili;
	this.name = name;
}
$.extend(PB.Timer.prototype, {
	start: function() {
		this.startMili = Date.now();
		return this;
	},
	end: function(msg) {
		this.endMili = Date.now();
		var message = msg || " executed in ";
		var total = this.endMili - this.startMili;
		console.log(this.name + message + total + " ms");
	}
});

/* Helper for measuring hidden dimensions
 * briefly shows all the hidden parents of the element
 * Usage:
 * var hide = new PB.HiddenDimensions(el)
 * hide.startMeasure()
 * hide.endMeasure()
 * http://devblog.foliotek.com/2009/12/07/getting-the-width-of-a-hidden-element-with-jquery-using-width/
 */
PB.ShowForMeasure = function(el) {
	this.el = $(el);
};

PB.ShowForMeasure.prototype = {
	props:	{ position: 'absolute', visibility: 'hidden', display: 'block' },
	startMeasure: function() {
		this.hiddenParents = this.el.parents().andSelf().not(':visible').get();
		this.oldProps = new Array(this.hiddenParents.length);
		for (var i=0; i< this.hiddenParents.length; i++)
		{
			this.oldProps[i] = {};
			for (var name in this.props) {
				this.oldProps[i][name] = this.hiddenParents[i].style[name];
				this.hiddenParents[i].style[name] = this.props[name];
			}
		}
	},
	endMeasure: function() {
		for (var i=0; i< this.hiddenParents.length; i++) {
			for (var name in this.props)
				this.hiddenParents[i].style[name] = this.oldProps[i][name];
		}
	}
};

// Event broadcaster mixin. Use to extend any object as event broadcaster
// Usage:
// function MyBroadcaster() {
//		...your init code here ....
//   $.extend(this, new PB.EventBroadcaster("docLoaded"));
// }
//
// Broadcaster sends events:
// this.send('docLoaded', doc);
//
// Listeners can bind & unbind.
// myBroadcaster.bind("docLoaded", function(doc) {})

PB.EventBroadcaster = function(eventList) {
	this.listeners = {};
	var that = this;
	eventList.split(' ').forEach( function(val, index, arr) {
		that.listeners[val] = [];
	});
};

$.extend(PB.EventBroadcaster.prototype, {
	bind: function(eventType, handler) {
		if (!eventType in this.listeners)
			throw "unknown event type " + eventType;
		this.listeners[eventType].push(handler);
	},
	unbind: function(eventType, handler) {
		if (!eventType in this.listeners)
			throw "unknown event type " + eventType;
		var i = this.listeners[eventType].indexOf(handler);
		if (i != -1)
			this.listeners[eventType].splice(i, 1);
	},
	send: function(eventType /* optional args */) {
		if (!eventType in this.listeners)
			throw "unknown event type " + eventType;
		for (var i=0; i < this.listeners[eventType].length; i++) {
			var f = this.listeners[eventType][i];
			switch(arguments.length) {
			case 1:
				f.call(); 
				break;
			case 2:
				f.call(null, arguments[1]); 
				break;
			case 3:
				f.call(null, arguments[1], arguments[2]); 
				break;
			default:
				throw("Cannot send this many arguments: " +(arguments.length - 1));
			}
		};
	}
});

$.extend(PB, {
	// Generates random id for an element
	generateId: function(el) {
		el = $(el).get(0);
		if (el.id) {
			console.error("PB.generateId: id already exists " + el.id);
			throw "PB.generateId: id already exists";
		}
		var id = "br" + Math.floor(Math.random() * 99999);
		if (!document.getElementById(id))
			el.id = id;
		else
			PB.generateId(el);
	},
	// Asserts element has an id
	assertId: function(el) {
		el = $(el).get(0);
		if (!el.id) {
			console.error("No id found" + el);
			debugger;
			throw "PB.assertId failed";
		}
	}
});

// DeferredFilter is part of DeferredQueue framework
// filters are notified when job starts/completes
// see prototype for callback function signatures
PB.DeferredFilter = function(callbacks) {
	this.ready = callbacks.ready;
	this.jobStarted = callbacks.jobStarted;
	this.jobCompleted = callbacks.jobCompleted;
};

PB.DeferredFilter.prototype = {
	ready: function() {return true;},	// true means job allowed
	jobStarted: function(deferredJob) {},
	jobCompleted: function(deferredJob) {}
}

// Concurrent filter limits number of simultaneous operations
PB.DeferredFilter.getConcurrentFilter = function(maxConcurrent) {
	var filter = new PB.DeferredFilter({
		ready: function( ) {
			return this.jobCount < this.jobLimit;
		},
		jobStarted: function(job) {
			this.jobCount += 1;
		},
		jobCompleted: function(job) {
			this.jobCount -= 1;
		}
	});	
	filter.jobCount = 0;
	filter.jobLimit = maxConcurrent;
	return filter;
}

// MemorySize filter limits memory used during ttl. Used for loading images
PB.DeferredFilter.getMemorySizeFilter = function(maxSize, ttl) { // bytes, milis
	var filter = new PB.DeferredFilter({
		ready: function() {
			// Remove expired elements
			var tooOld = Date.now() - this.ttl;
			this.jobTotals = this.jobTotals.filter(function(el) {
				return el.endTime > tooOld;
			});
			// Calculate the total
			var total = this.jobTotals.reduce(function(prev, curr, index, arry) {
				return prev + curr.size;
			}, 0);
			return total < this.maxSize;
		},
		jobStarted: function(job) {
		},
		jobCompleted: function(job) {
			if ('memory_size' in job)
				filter.jobTotals.push({ endTime: Date.now(), size: job.memory_size });
			else
				console.warn("job without memory size");
		}
	});
	filter.jobTotals = []; // array of { completed: Time(), size: int }]
	filter.maxSize = maxSize;
	filter.ttl = ttl;
	return filter;
}

// NetworkError filter 
PB.DeferredFilter.getNetworkErrorFilter = function() {
	if (this.networkErrorFilter)	// singleton
		return this.networkErrorFilter;
		
	var filter = new PB.DeferredFilter({
		ready: function(queue) {
			return this._netDown == false || this._secondsLeft == 0;
		},
		jobStarted: function(job) {			
		},
		jobCompleted: function(job) {
			this.setNetworkError(job.isRejected());
		}
	});
	
	var networkErrorPrototype = {
		_netDown: false,	// Network is down?
		_timeoutId: false, // window.setTimeout id
		_initialDelay: 5,
	
		// xhrFailure is called every time xhr fails
		xhrFailure: function(jqXHR, status, ex) {
			// Detect if it is network down type error, 
			debugger;
		},
		setNetworkError : function(err) {
			if (err)
			{
				if(!this._netDown) 
				{
					this._netDown = true;
					this._initialDelay = 5;	// seconds
					this._secondsLeft = this._initialDelay;
					this.setTimeoutIf();
				}
				else if (this._secondsLeft == 0) {
					// timer already fired, double time, and retry again
						this._initialDelay = Math.min(this._initialDelay * 2, 60);
						this._secondsLeft = this._initialDelay;
						this.setTimeoutIf();
				}
			}
			else
				if (this._netDown)
				{
					this._netDown = false;
					if (this._timeoutId)
						window.clearTimeout(this._timeoutId);
					this._timeoutId = false;
					$(PB.getMessageBar("network_retry")).remove();
				}
		},
		setTimeoutIf: function() {
			if (this._timeoutId == false && this._netDown) {
				var THIS = this;
				this._timeoutId = window.setTimeout(function() { THIS.windowTimer()} , 1000);
			}
		},
		windowTimer: function() {
			this._secondsLeft = Math.max(0, this._secondsLeft - 1);
			this.displayDelayMessage();
			this._timeoutId = false;
			this.setTimeoutIf();
			if (this._netDown && this._delayTimer > 0)
				this.setTimeoutIf();
		},
		displayDelayMessage: function() {
			var bar = PB.getMessageBar("network_retry");
			$(bar).show();
			bar.innerHTML = "A network error has occured. Retry in " + this._secondsLeft;
		}
	}
	
	$.extend(filter, networkErrorPrototype);
	this.networkErrorFilter = filter;
	return filter;
}

// DeferredJob is part of DeferredQueue framework
// just like deferred, except it does not execute until start is called
PB.createDeferredJob = function(name, startFn) {
	var job = new $.Deferred(function() {
		this.start = startFn;
		this.name = name;
	});
	return job;
};

/*
 * DeferredQueue class
 * Queues up deferreds for execution. The deferreds have a start method
 * Deferred queue decides when to execute depending upon filters.
 * Filters are notified when jobs are started/done
 * Keeps track of currently active jobs
 */
PB.DeferredQueue = function(filters) {
	this._waitJobs = [];
	this._activeJobs = [];
	this._filters = filters || [];
	this.timeout = null;
}

PB.DeferredQueue.prototype = {
	// number of waiting + active jobs
	get length() {
		return this._waitJobs.length + this._activeJobs.length;
	},
	push: function(deferredJob) {
//		console.log("Push " + deferredJob.name);
		this._waitJobs.push(deferredJob);
		this.process();
	},
	unshift: function(deferredJob) {
		this._waitJobs.unshift(deferredJob);
		this.process();
	},
	// execute any jobs we can
	process: function() {
		var THIS = this;
		while (this._waitJobs.length > 0 
			&& this._filters.every(function(el) { return el.ready(THIS);})
			) {
			this.execute(this._waitJobs.shift());
		}
		// Set up heartbeat if there are outstanding jobs
		if (this._waitJobs.length > 0 && this.timeout == null) {
			var THIS = this;
			this.timeout = window.setTimeout(function() {
//				console.log("DeferredQueue timeout fired");
				THIS.timeout = null;
				THIS.process();
			}, 1000);
//			console.log("DeferredQueue timeout set" + this.timeout);
		}
		else
			;//console.warn("DefferedQueue timeout not empty " + this.timeout);
	},
	// sets up the job for execution, and executes it
	execute: function(deferredJob) {
//		console.log("Execute " + deferredJob.name);
		var THIS = this;
		// Notify filters that job is starting
		this._filters.forEach(function(filter) {
			filter.jobStarted(deferredJob);
		});
		// Notify filters when job completes
		deferredJob.always(function() {
			THIS._filters.forEach(function(filter) {
				filter.jobCompleted(deferredJob);
			});
				THIS._activeJobs.splice(THIS._activeJobs.indexOf(deferredJob), 1);
			THIS.process();
		});
		// start the job
		this._activeJobs.push(deferredJob);
		deferredJob.start();
	}
}

// Image loading for display queue
// Limits how many images:
// - can be downloaded simultaneusly
// - can be downloaded in a 10 second window. This is to prevent
//	 memory trashing, FF keeps all images in used memory for 10 seconds, 
//   unused for 25. When loading images off local disk, single image can be
//   4928 x 3264 x 4 = 60MB undecoded.
// 	 TestPix loads 100 images in 64s
// gfx/surface/image cache can still grow to 1.X
PB.ImageLoadQueue = new PB.DeferredQueue([
	PB.DeferredFilter.getConcurrentFilter(2),
	PB.DeferredFilter.getMemorySizeFilter(600 * 1048576, // 600MB
		10 * 1000 // 10seconds
		)
]);

// Uploads pages/images/books to the server

PB.UploadQueue = function(name) {
	this._name = name;
	this._waitJobs = [];
	this._timeout = null;
	this._verbose = false;
	this._networkErrorFilter = PB.DeferredFilter.getNetworkErrorFilter();
	this._concurrentFilter = PB.DeferredFilter.getConcurrentFilter(1);
	this._filters = [ 
		this._networkErrorFilter,this._concurrentFilter ];
}

$.extend(PB.UploadQueue.prototype, {
	
	// Queue items need to implement createUploadDeferred() method
	upload: function(item) {
		if (this._waitJobs.indexOf(item) != -1)
			return;
		this._waitJobs.push(item);
		this.process();
	},
	
	// Process picks a job to be executed
	process: function() {
		var THIS = this;
		while (this._waitJobs.length > 0 
			&& this._filters.every(function(el) { return el.ready();})
			) {
			this.execute(this._waitJobs.shift());
		}
		// Set up heartbeat if there are outstanding jobs
		if (this._waitJobs.length > 0 && this._timeout == null) {
			var THIS = this;
			this._timeout = window.setTimeout(function() {
//				console.log("DeferredQueue timeout fired");
				THIS._timeout = null;
				THIS.process();
			}, 1000);
//			console.log("DeferredQueue timeout set" + this.timeout);
		}
		else
			;//console.warn("DefferedQueue timeout not empty " + this.timeout);
	},
	
	// Starts the upload of the item. Retries in case of network down error
	execute: function(item) {
	//		console.log("Execute " + deferredJob.name);
		var THIS = this;
		var isImage = item instanceof PB.ImageBroker;
		var isPage = item instanceof PB.BookPage;
		var job  = item.createUploadDeferred();
		if (isImage)
			PB.progressSetup({message: "-> " + item.name(), show:true});
		else
			PB.progressSetup({message: "Saving page " + item.id});
		// Notify filters that job is starting
		this._filters.forEach(function(filter) { filter.jobStarted(job); });
		this.display_verbose();
		// Retry item if job fails with network error
		job.fail( function(jqXHR, status, ex) {
			// notify the network error
			THIS._networkErrorFilter.xhrFailure(jqXHR, status, ex);
			// put job back in front
			THIS._waitJobs.unshift(item);
		});

		// Notify filters when job completes
		job.always(function() {
			PB.progress();
			THIS._filters.forEach(function(filter) { filter.jobCompleted(job); });
			THIS.process();
		});
	},
	
	hasJobs: function() {
		return this._concurrentFilter.jobCount > 0 ||
			this._waitJobs.length > 0;
	},
	
	display_verbose: function() {
		if (this._verbose) {
			var imgCount = this._waitJobs.filter(function(e) { e instanceof PB.ImageBroker}).length;
			var pageCount = this._waitJobs.filter(function(e) { e instanceof PB.BookPage}).length;
			var status = "Uploading ";
			if (imgCount) status += imgCount + " images, ";
			if (pageCount) status += pageCount + " pages";
			// TODO switch to custom message div
			PB.notice(status);
		}
	},
	
	set verbose(val) {
		this._verbose = val;
		this.display_verbose();
	}
});

PB.uploadQueue = new PB.UploadQueue("Pages and Images");

// Save modified pages every minute.
window.setInterval(function() {
	PB.BookPage.saveAll();
}, 60*1000);
/*
 * Give user a chance to save changes before navigating away
 */
window.onbeforeunload = function(e) {
	PB.BookPage.saveAll();
	if (PB.uploadQueue.hasJobs()) {
		PB.uploadQueue.verbose = true;
		if (e)
			e.returnValue = "You have unsaved changes. Are you sure that you want to leave the page?";
		return "You have unsaved changes. Are you sure that you want to leave the page?"
	}
};
