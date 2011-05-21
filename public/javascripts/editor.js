"use strict";

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
		
	function svgWrapper(el) {
		this._svgEl = el;
		this.__proto__ = el;
		Object.defineProperty(this, "className", {
			get:  function(){ return this._svgEl.className.baseVal; },
			set: function(value){    this._svgEl.className.baseVal = value; }
		});
		Object.defineProperty(this, "width", {
			get:  function(){ return this._svgEl.width.baseVal.value; },
			set: function(value){    this._svgEl.width.baseVal.value = value; }
		});
		Object.defineProperty(this, "height", {
			get:  function(){ return this._svgEl.height.baseVal.value; },
			set: function(value){    this._svgEl.height.baseVal.value = value; }
		});
		Object.defineProperty(this, "x", {
			get:  function(){ return this._svgEl.x.baseVal.value; },
			set: function(value){    this._svgEl.x.baseVal.value = value; }
		});
		Object.defineProperty(this, "y", {
			get:  function(){ return this._svgEl.y.baseVal.value; },
			set: function(value){    this._svgEl.y.baseVal.value = value; }
		});
		Object.defineProperty(this, "offsetWidth", {
			get:  function(){ return this._svgEl.width.baseVal.value; },
			set: function(value){    this._svgEl.width.baseVal.value = value; }
		});
		Object.defineProperty(this, "offsetHeight", {
			get:  function(){ return this._svgEl.height.baseVal.value; },
			set: function(value){    this._svgEl.height.baseVal.value = value; }
		});
	};

	jQuery.fn.wrapSvg = function() {
		return this.map(function(i, el) {
			if (el.namespaceURI == "http://www.w3.org/2000/svg" && 
				!('_svgEl' in el)) {
				var x =  new svgWrapper(el);
				return x;
			}
			else
				return el;
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
// Listeners can bind & unbind.
// Send events:
// this.send('docLoaded', doc);

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


// DeferredFilter is part of DeferredQueue framework
// filters are notified when job starts/completes
// see prototype for callback function signatures
PB.DeferredFilter = function(callbacks) {
	this.ready = callbacks.ready;
	this.jobStarted = callbacks.jobStarted;
	this.jobCompleted = callbacks.jobCompleted;
};

PB.DeferredFilter.prototype = {
	ready: function(queue) {return true;},	// true means job allowed
	jobStarted: function(deferredJob, queue) {},
	jobCompleted: function(deferredJob, queue) {}
}

// Concurrent filter limits number of simultaneous operations
PB.DeferredFilter.getConcurrentFilter = function(maxConcurrent) {
	var filter = new PB.DeferredFilter({
		ready: function( queue) {
			return this.jobCount < this.jobLimit;
		},
		jobStarted: function(job, queue) {
			this.jobCount += 1;
		},
		jobCompleted: function(job, queue) {
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
		ready: function(queue) {
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
		jobStarted: function(job, queue) {
		},
		jobCompleted: function(job, queue) {
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
		jobStarted: function(job, queue) {			
		},
		jobCompleted: function(job, queue) {
			this.setNetworkError(job.isRejected());
		}
	});
	
	var networkErrorPrototype = {
		_netDown: false,	// Network is down?
		_timeoutId: false, // window.setTimeout id
		_initialDelay: 5,
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
			filter.jobStarted(deferredJob, THIS);
		});
		// Notify filters when job completes
		deferredJob.always(function() {
			THIS._filters.forEach(function(filter) {
				filter.jobCompleted(deferredJob, THIS);
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

PB.ImageUploadQueue = new PB.DeferredQueue([
	PB.DeferredFilter.getConcurrentFilter(1),
	PB.DeferredFilter.getNetworkErrorFilter()
]);

PB.ImageUploadQueue.displayStatus = function() {
	var notice = PB.getMessageBar("image_upload_notice");
	if (PB.ImageUploadQueue.length > 0) {
		$(notice).show();
		notice.innerHTML = this.length + " images are uploading.";
		window.setTimeout(PB.ImageUploadQueue.displayStatus, 300);
	}
	else
		$(notice).remove();
};

PB.PageUploadQueue = new PB.DeferredQueue([
	PB.DeferredFilter.getConcurrentFilter(1),
	PB.DeferredFilter.getNetworkErrorFilter()
]);

// Page upload queue saves pages at most once every 60 seconds
// Or immediately if saveNow is called
$.extend(PB.PageUploadQueue, {
	_timedQueue: {}, // hash page_id => [page, saveTime]
	_uploadTimeout: null,	
	countPageQueue: function() {
		var i = 0;
		for ( var page_id in this._timedQueue )
			i++;
		return i;
	},
	get extraLength() {
		return this.length + this.countPageQueue();
	},
	readyToSave: function(page)
	{
		if ( page.id in this._timedQueue )
			return;
		console.log("PageQueue readyToSave ", page.id);
		this._timedQueue[page.id] = [page, Date.now() + 60 * 1000]
		this.processPageQueue();
		return this;
	},
	saveNowIfNeeded: function(page)
	{
		console.log("PageQueue saveNowIfNeeded ", page.id);
		if (!(page.id in this._timedQueue))	// No need to save if not in queue
			return;
		this._timedQueue[page.id] = [page, 0];
		this.processPageQueue();
		return this;
	},
	processPageQueue: function() {
		var now = Date.now();
		var haveWaitingPages = false;
		var log = "";
		// Move pages to pageQueue->waitQueue
		for ( var page_id in this._timedQueue ) {
			log += " " + page_id;
			if (this._timedQueue[page_id][1] <= now) {
				console.log("PageQueue -> DeferredQueue " + page_id);
				this.push(this._timedQueue[page_id][0].getSaveDeferred());
				delete this._timedQueue[page_id];
			}
			else
				haveWaitingPages = true;
		}
		// console.log("PageQueue process " + log);
		// Wake ourselves up with a timeout
		if (haveWaitingPages && this._uploadTimeout == null)
		{
				var THIS = this;
				this._uploadTimeout = window.setTimeout(function() {
					//console.log("PageQueue timeout fired");
					THIS._uploadTimeout = null;
					THIS.processPageQueue();
				}, 1000);
			//	console.log("PageQueue timeout set" + this._uploadTimeout);
		}
	},
	saveAllNow: function()
	{
		for ( var page_id in this._timedQueue ) {
			this.push(this._timedQueue[page_id][0].getSaveDeferred());
			delete this._timedQueue[page_id];
		}
		return this;
	}
});
/*
 * Give user a chance to save changes before navigating away
 */
window.onbeforeunload = function(e) {
	var haveChanges = false;
	if (PB.ImageUploadQueue.length > 0) {
		haveChanges = true;
		PB.ImageUploadQueue.displayStatus();
	}
	if (PB.PageUploadQueue.extraLength > 0)
	{
		haveChanges = true;
		PB.PageUploadQueue.saveAllNow();
		PB.notice("Saving pages.");
	}
	if (haveChanges) {
		if (e)
			e.returnValue = "You have unsaved changes. Are you sure that you want to leave the page?";
		return "You have unsaved changes. Are you sure that you want to leave the page?"
	}
};
