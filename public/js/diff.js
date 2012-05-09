// diff.js
/*
Comparing objects in javascript

patch format:
[
	{
		'path' : '', // jsonpath
		'op': 'add/remove', //
		'op_args': {} 
	}
]
http://c2.com/cgi/wiki?DiffAlgorithm
*/

/************************************************************************************
	JsonPath implementation

	JsonPath(obj, path) => [ encapsulated_results* ]
		returns an array of matched objects.
		throws errors on failure

		For matched object api, see encapsulator.prototype: val(), set(), path().

  Path syntax: (bare, see http://code.google.com/p/jsonpath/wiki/ExprSyntax for full path)

  $ : root
  . : child operator
  [x]: array index

	Usage:
  match = JsonPath(obj, path)
  if (match.length == 0)
   ; // empty
  for (var i=0; i++; i < match.length) {
		match[i].val(); // value of the match
		match[i].set("blah");	// sets new value for matched node
		match[i].path(); // returns path
		console.log(match[i]); // print path/value
  }
***************************************************************************************/

"use strict";
(function(window) {

	// Encapsulate the results, so we can set the values, get their paths
	function encapsulator(obj, prop, path) {
		this._obj = obj;
		this._prop = prop;
		this._path = path;
	}
	encapsulator.prototype = {
		val: function() {
			if (this._prop != undefined ) return this._obj[this._prop];
			return this._obj;
		},
		set: function(val) {
			if (this._prop != undefined ) return this._obj[this._prop] = val;
			throw "Can't set root object";
		},
		delete: function(val) {
			if (this._prop != undefined ) 
			{
				if (this._obj instanceof Array) {
					// array delete is a splice
					if (this._obj.length-1 != parseInt(this._prop))
						throw "Deletion from middle of array attempted";
					else
						this._obj.splice(this._prop, 1);
				}
				else
					delete this._obj[this._prop];
			}
			else
				throw "Can't delete root object";
		},
		path: function() {
			var r = this._path.join('.');
			if (this._prop != undefined ) r += "." + this._prop;
			return r;
		},
		toString: function() {
			return this.path() + " : " + this.val();
		}
	}

	function getType(obj) {
		if (obj instanceof Array)
			return 'Array';
		else if (obj instanceof Object)
			return 'Object';
		else
			return 'Basic';
	}

	function array_clone_push(array, element) {
		var new_array = array.slice(0);
		new_array.push(element);
		return new_array;
	}

	function traverse(obj, path_array, path_to_here, options) {
		var el = [];
		if (path_array.length == 0)
			return null;
		else if (path_array.length == 1) { // leaf, return values
			if (path_array[0] == "$") // $
				el.push(new encapsulator(obj, null, path_to_here));
			else if (path_array[0] == "*") { // *
				switch(getType(obj)) {
					case 'Array':
						for (var i = 0; i < obj.length; i++)
							el.push(new encapsulator(obj, i, path_to_here));
						break;
					case 'Object':
						for (var propName in obj)
							if (obj.hasOwnProperty(propName))
								el.push(new encapsulator(obj, propName, path_to_here));
						break;
					case 'Basic':
						throw "Nothing to traverse at" + path_to_here.join('.') + '.*';
						break;
				}
			}
			else { // common case
				if (options['ghost_props'] || obj.hasOwnProperty(path_array[0]))
					el.push(new encapsulator(obj, path_array[0], path_to_here));
			}
		}
		else // branch, keep on traversing
		{
			if (path_array[0] == "$") {
				el = traverse(obj, 
					path_array.slice(1), 
					array_clone_push(path_to_here, path_array[0]),
					options);
			}
			else if (path_array[0] == "*") {
				switch(getType(obj)) {
					case 'Array':
						var trim_path = path_array.slice(1);
						for (var i=0; i < obj.length; i++) {
							el = el.concat( 
								traverse(obj[i], 
									trim_path, 
									array_clone_push(path_to_here, i), 
									options));
						}
						break;
					case 'Object':
						var trim_path = path_array.slice(1);
						for (var propName in obj)
							if (obj.hasOwnProperty(propName))
								el = el.concat(
									traverse(obj[propName], 
										trim_path, 
										array_clone_push(path_to_here, propName), 
										options));
						break;
					case 'Basic':
						throw 'nothing to traverse at' + path_to_here.join('.') + ".*";
				}
			}
			else {
				var o2 = obj[path_array[0]];
				if (o2)
					el = traverse(o2, 
						path_array.slice(1), 
						array_clone_push(path_to_here, path_array[0]),
						options);
			}
		}
		return el;
	}

	// Transforms "$.a.b[3].c" into [ '$', 'a', 'b', '[3]', 'c' ]
	function canonical_path(path) {
		var p = path.replace(/\./g, ';'); // a.b => a;b
		p = p.replace(/\[/g, ';['); // p[2] => p;[2]
		p = p.replace(/\[([^\]]+)\]/g, "$1"); // [2] => 2
//		console.log(p);
		return p.split(';');
	}

	function jsonPath(obj, path, options) {
		options = options || {};
		var defaults = {
			'just_one': false,
			'ghost_props': false	// return non-existent leaf property accessors, used to set them
		}
		for (var p in defaults)
			if (!options.hasOwnProperty(p))
				options[p] = defaults[p];

		if (!obj || !path) throw "Empty object or path";
		var c_path = canonical_path(path);

		var retVal = traverse(obj, c_path, [], options);
		if (options['just_one']) {
			if (retVal.length > 1) throw "Multiple arguments returned, just_one requested";
			return retVal.length == 0 ? null : retVal[0];
		}
		return retVal;
	}

	window.JsonPath = jsonPath;

})(this);

/*
// DoublyLinkedList
// simple homemade implementation
(function(window) {
	function DoublyLinkedListItem(val) {
		this.prev = null;
		this.next = null;
		this.val = val;
	}
	function DoublyLinkedList() {
		this.first = null;
		this.last = null;
	}
	DoublyLinkedList.fromArray = function(arry) {
		var list = new DoublyLinkedList();
		for (var i =0; i< arry.length; i++)
			list.pushVal(arry[i]);
		return list;
	}
	DoublyLinkedList.prototype = {
		// Returns array of DoublyLinkedListItems, if you want that kind of thing
		toItemArray: function() {
			var array = [];
			this.each(function(item) {
				array.push(item);
			});
			return array;
		},
		// Returns item values as array. If asItems true, returns array of DoublyLinkedListItem
		toArray: function(asItems) {
			var array = [];
			this.each( function(item) {
				array.push(asItems ? item : item.val);
			});
			return array;
		},
		each: function(cb) {
			var item = this.first;
			while (item) {
				cb(item);
				item = item.next;
			}
		},

		pushVal: function(val) {
			var item = new DoublyLinkedListItem(val);
			if (this.first == null) {
				this.first = this.last = item;
			}
			else {
				this.last.next = item;
				item.prev = this.last;
				this.last = item;				
			}
			return item;
		},
		remove: function(item) {
			if (item == this.first)
				this.first = item.next;
			else if (item == this.last)
				this.last = item.prev;
			if (item.prev)
				item.prev.next = item.next;
			if (item.next)
				item.next.prev = item.prev;
		}
	}

	window.DoublyLinkedList = DoublyLinkedList;
})(this);
*/

// JsonDiff
(function(window) {

	function mergeOptions(options, defaults)
	{
		options = options || {};
		for (var p in defaults)
			if (!options.hasOwnProperty(p))
				options[p] = defaults[p];
		return options;
	}

	function getType(obj) {
		if (obj instanceof Array)
			return 'Array';
		else if (obj instanceof Object)
			return 'Object';
		else
			return 'Basic';
	}

	function iterateObject(obj, callback) {
		switch(getType(obj)) {
			case 'Array':
				for (var i=0; i<obj.length; i++)
					callback(obj, i);
		}
	}
	function createUpdate(path, value, oldValue) {
/*		var retVal = createDelete(path, oldValue, {'implicit': true}); 
		var retVal = retVal.concat( createInsert(path, value));*/
		return createInsert(path, value);
//		return retVal;
	}

	function createSimpleInsert(path, value) {
		return { 'op' : 'insert', 'path': path, 'args' : value }
	}

	function createInsert(path, value) {
		var retVal = [];
		switch(getType(value)) {
			case 'Object': // Insert empty object, populate props
				retVal.push( createSimpleInsert(path, {}));
				for (var p in value)
					retVal = retVal.concat( createInsert(path + "." + p, value[p]));
				break;
			case 'Array': // Insert empty array, populate props
				retVal.push( createSimpleInsert(path, []));
				for (var i = 0; i<value.length; i++)
					retVal = retVal.concat(createInsert(path + "." + i, value[i]));
				break;
			case 'Basic':
				retVal.push( createSimpleInsert(path, value));
				break;
		}
		return retVal;
	}

	function createSimpleDelete(path, value, options) {
		return { 'op': 'delete', 'path': path, 'args': value, 'implicit': options['implicit'] }
	}

	// options: implicit: true|false
	// implicit means that the delete can be discarded without changing patch results
	//    implicit is used to record values 'implicitly' deleted when field is updated
	//    createUpdate function uses this.
	function createDelete(path, value, options) {
		options = mergeOptions(options, {implicit: false});

		var retVal = [];

		switch (getType(value)) {
			case 'Object':
				for (var p in value)
					retVal = retVal.concat( createDelete(path + "." + p, value[p], options));
				retVal.push( createSimpleDelete(path, value, options));
				break;
			case 'Array':
				for (var i=value.length-1; i>=0; i--)
					retVal = retVal.concat( createDelete(path + "." + i, value[i], options));
				retVal.push( createSimpleDelete(path, value, options));
				break;
			case 'Basic':
				retVal.push( createSimpleDelete(path, value, options));
				break;
		}
		return retVal;
	}
/*
	function createMove(src, dest) {
		return { op: 'move', path: src, args: dest}
	}
*/
	function applyDiff(obj, diff) {
		switch(diff.op) {
			case 'insert':
				var target = JsonPath(obj, diff.path, {'just_one': true, 'ghost_props': true});
				if (target)
					target.set(diff.args);
				else
					throw "Could not INSERT, target not found";
				break;
			case 'delete':
				if (diff.implicit)
					break;
				var target = JsonPath(obj, diff.path, {'just_one':true });
				if (target)
					target.delete();
				else
					throw "Could not DELETE, target not found";
				break;
/*			case 'move':
				var src = JsonPath(obj, diff.path, {'just_one':true});
				var dest = JsonPath(obj, diff.args, {'just_one': true, 'ghost_props':true});
				if (src && dest) {
					dest.set(src.val());
					src.delete();
				}
				else
					throw "Could not MOVE" 
						+ (src ? "" : diff.path + " not found ") 
						+ (dest ? "" : diff.args + " not found ");
				break; */
			default:
				throw "Unknown operation " + diff.op;
		}
	}

	function printDiff(diff) {
		if (diff instanceof Array)
			diff.forEach( function(d) { printDiff(d)});
		else {
			if (diff.implicit)
				console.warn(diff.path, " ", diff.op, " ", diff.args);
			else
				console.log(diff.path, " ", diff.op, " ", diff.args);
		}
		return "";
	}

	// Return patch between two objects
	function jsonObjectDiff(oldObj, newObj, path)
	{
		var justOld = [];	// props just in oldObj
		var justNew = [];
		var inBoth = [];
		for (var prop in oldObj)
			if (newObj.hasOwnProperty(prop))
				inBoth.push(prop);
			else
				justOld.push(prop);
		for (var prop in newObj)
			if (!oldObj.hasOwnProperty(prop))
				justNew.push(prop);

		var diff = [];
		justOld.forEach( function(p) { 
			diff = diff.concat(
				createDelete(path + "." + p, oldObj[p]));
		});
		justNew.forEach( function(p) {
			diff = diff.concat(
					createInsert( path + "." + p, newObj[p] ));
			});
		inBoth.forEach( function(p) {
			diff = diff.concat( jsonDiffHelper( oldObj[p], newObj[p], path + "." + p));
		});
		return diff;
	}

	function jsonArrayDiff(oldObj, newObj, path)
	{
		var diff = [];
		// backward iteration because items can only be removed from end of an array
		for (var i= oldObj.length - 1; i >= 0; i--) 
		{
			var newPath = path + "." + i;
			if (i < newObj.length) {
				diff = diff.concat( 
									jsonDiffHelper(oldObj[i], newObj[i], newPath));
			}
			else
				diff = diff.concat( createDelete(newPath, oldObj[i]));
		}
		// TODO remove items backward
		for (var i = oldObj.length; i < newObj.length; i++) 
		{
			var newPath = path + "." + i;
			diff = diff.concat( createInsert(newPath, newObj[i]));			
		}
		return diff;
	}

	// Return patch to turn oldObj into newObj
	// patch is an array of diffs
	// path is an xpath to left|right objects
	function jsonDiffHelper(oldObj, newObj, path) {
		path = path || "$";
		var oldType = getType(oldObj);
		var newType = getType(newObj);
		var retVal = [];
		if (oldType != newType)
			retVal = createUpdate(path, newObj, oldObj);
		else switch(oldType) 
		{
			case 'Basic':
				if (newObj != oldObj)
					retVal = createUpdate(path, newObj, oldObj); break;
			case 'Array':
				retVal = jsonArrayDiff(oldObj, newObj, path); break;
			case 'Object':
				retVal = jsonObjectDiff(oldObj, newObj, path); break;
		}
		return retVal;
	}

	// Removes crud: implicit ops, delete args
	function cleanupDiff(diff) {
		var newDiff = [];
		for (var i=0; i<diff.length; i++) {
			if (!('implicit' in diff[i]) || (diff[i].implicit == false)) {
				if ('implicit' in diff[i])
					delete diff[i].implicit;
				switch(diff[i].op) {
					case 'delete':
						diff[i].args = null;
						break;
					default:
						break;
				}
				newDiff.push(diff[i]);
			}
		}
		return newDiff;
	}

	function compareDiffArgs(a,b) {
		var type_a = getType(a.args);
		var type_b = getType(b.args);
		if (type_a == type_b) 
			switch(type_a) {
				case 'Object':
				case 'Array':
					return 0;
				default:
					return a.args == b.args ? 0 : a.args < b.args ? -1 : 1;	// a <=> b
			}
		else  // Object > Array > Basic
			if (type_a == 'Basic')
				return -1;
			else if (type_b == 'Basic')
				return 1;
			else if (type_a == 'Array')
				return -1;
			else 
				return 1;
	}

	function compareDiffPaths(a,b) {
		if (a.path < b.path)
			return -1;
		else if (b.path < a.path)
			return 1;
		else 
			return 0;
	}

	/* Optimizations did not work
	I was hoping to replace delete/insert pairs with a single move
	This fails because delete and insert position in diff queue is important:
	- insert: parents must be inserted before the child
	- delete: children must be deleted before the parent
	The main motivation for move was to avoid massive diffs when an array is shuffled
	This would happen if pages were kept as an array
	Takeaway: minimize array use.

	function optimizeDiff(oldObj, newObj, diff)
	{
		function optimizeToMove(diffList, insertOp, deleteOp)
		{
			var src = deleteOp.val.path;
			// if src is an array indice path with index X

			// Converting deleteOp to move on an array item will make later indices be off by 1
			// We must find and patch all of them
			var isArrayMatch = src.match(/^(.*\.)(\d+)$/);	// "a.b.c.1" means c is an array

			if (isArrayMatch) {
				// shift all indices into this array in diffs after deleteOp diff
				var srcIndex = parseInt(isArrayMatch[2]);
				// match paths that reference the same array
				// create a matching regex, escape special characted
				// "a.b.c.1" would create a regex: /(a\.b\.c\.)(\d+)
				var matchingRegex = new RegExp( 
					"^(" + isArrayMatch[1].replace(/[\\\^\$\*\+\?\(\)\[\]\.\!\:\|\{\}\/]/g, "\\$&") + ")"
					+ "(\\d+)" + "(.*)$" 
				);
				var next = insertOp.next;
				while (next) {
					var isPathMatch = matchingRegex.exec(next.val.path);
					if (isPathMatch) {
						var matchingIndex = parseInt(isPathMatch[2]);
						if (matchingIndex > srcIndex) {
							next.val.path = isPathMatch[1] + (matchingIndex - 1) + isPathMatch[3];
						}
					}
					next = next.next;
				}
			}
			// change delete to move, and remove the insertOp
			var moveDiff = createMove(deleteOp.val.path, insertOp.val.path);
			deleteOp.val = moveDiff;
			diffList.remove(insertOp);
		}

		// Create doubly-linked list of diffs. Used for easy insert/remove
		var diffList = DoublyLinkedList.fromArray(diff);
		// Sort diffs by arg values
		var diffItemArray = diffList.toArray(true);
		diffItemArray.sort(function(a,b) {
			return compareDiffArgs(a.val, b.val);
		});
		// Separate arg values into buckets
		var buckets = [];
		var currBucket = null;
		for (var i=0; i<diffItemArray.length; i++)
		{
			if (currBucket != null && compareDiffArgs(currBucket[0].val, diffItemArray[i].val) == 0)
				currBucket.push(diffItemArray[i]);
			else {
				currBucket = [diffItemArray[i]];
				buckets.push(currBucket);
			}
		}
		// filter out the non-moving buckets
		buckets = buckets.filter(function(x) { return x.length > 1});
		// replace matching delete/inserts with moves
		for (var i=0; i<buckets.length; i++)
		{
			// cannot move arrays or objects yet
			if (buckets[i].length < 2 || getType(buckets[i][0].val.args) != 'Basic')
				continue;
			var inserts = [];
			var deletes = [];
			// group values into inserts and deletes
			for (var j=0; j < buckets[i].length ; j++)
				switch(buckets[i][j].val.op) {
					case 'insert':
						inserts.push(buckets[i][j]); break;
					case 'delete':
						deletes.push(buckets[i][j]); break;
					default:
						break;
				}
			// create the moves
			var possibleMoves = Math.min(inserts.length, deletes.length);
			for (var j=0; j < possibleMoves; j++)
				optimizeToMove(diffList, inserts[j], deletes[j]);
		}
		return diffList.toArray();
	}
	*/
	function jsonDiff(oldObj, newObj, options) {
		options = mergeOptions(options, {optimize: false, cleanup: false});
		var diff = jsonDiffHelper(oldObj, newObj, "$");
/*		if (options.optimize)
			diff = optimizeDiff(oldObj, newObj, diff);
*/
		if (options.cleanup)
			diff = cleanupDiff(diff)
		return diff;
	}

	// Clones the object, applies diff
	function jsonPatch(obj, diff) {
		var newObj = JSON.parse(JSON.stringify(obj));
		var diff = JSON.parse(JSON.stringify(diff)); // clone the diff because we do not want to modify original diff
		for (var i =0; i< diff.length ; i++)
		{
			try {
				applyDiff(newObj, diff[i]);
			}
			catch(e) {
				console.log("Patch failed " + e);
				printDiff(diff[i]);
				throw e;
			}
		}
		return newObj;
	}

	window.JsonDiff = {
		'diff': jsonDiff,
		'patch': jsonPatch,
		'prettyPrint': printDiff
	}

})(this);


/*
# Diff architecture notes

Requirements: 
- good performance on photobook use cases.
- no needless changes. if two values are the same, there should be no update
  this would happen if we naively swap entire objects when just part of their
  props differs

Algorithm
- generate raw insert/delete/update diff. Update has an implicit delete
- compare the insert with deletes. If they match, replace with move
  - tricky: if insert/delete can be replaced with move/update. (happens when page is edited, then moved)

# Operations

- insert
- delete
- update (also created implicit_delete of previous value)
- implicit_delete (created when update is performed, used to optimize, noop for patch)
- move

## Example 1: 'Object'
old {
	a: a
	b: a
	c: a
}
## Example 1a: 'Object', attribute value change
new {
	a: a
	b: b
	c: a
}
diff:
	$.b, 'update', 'b'
Nested attribute value change would work just as well

## Example 1b: 'Object', attribute deletion
new {
	a: a
	c: a
}
diff:
	$.b, 'delete'

## Example 1c: 'Object', attribute insertions
new { a: a, b: a, c: a, d: a}
diff:
	$.d, 'insert', 'a'


## Example 2: 'Array'
old = [
	a,b,c
]

## Example 2a: 'Array', item changed
new = [
	A,b,c
]
diff:
	$.1, 'update', 'A'

## Example 2b: 'Array', item deleted
new = [b,c]
diff, simple, not acceptable, can be length of array
 $.0, 'update', 'b'  // implicit deletion of a
 $.1, 'update', 'c'  // implicit
 $.2, 'delete'
diff, nice:
 $.0,  'move', $.1
 $.1,	 'move', $.2
 $.2,	 'delete'
 new = [a,c] // 

## Example 2c: 'Array'. item inserted
new = [a,a1,b,c]
diff:
	$.1, 'array-insert', 'a1'


What to do when arrays and objects are members of other arrays/objects?
The simple idea to just replace entire object does not work. Small changes
would generate large diff. For example, changing a page property would replace
the entire property array.
- treat objects as a single thing.
  pros: simple
  cons: horrendous performance, change of a single attribute regenerates the whole hierarchy



*/