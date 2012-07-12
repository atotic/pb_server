// diff.js
/*
Comparing objects in javascript

patch format:
[
	{
		'path' : '', // jsonpath
		'op': 'set/delete/insert/swap', //
		'op_args': {}
	}
]
- set: sets the value to new value
- delete: deletes the value (if array, shrinks)
- insert: inserts a new value (if array, grows)
- swap: swaps values
http://c2.com/cgi/wiki?DiffAlgorithm
*/

/************************************************************************************
	JsonPath implementation

	JsonPath(obj, path) => [ proxied_results* ]
		returns an array of matched objects.
		throws errors on failure

		For proxy api, see proxy.prototype: val(), set(), path().

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


(function(window) {
"use strict";
	// Encapsulate the results, so we can set the values, get their paths
	function Proxy(obj, prop, path) {
		this._obj = obj;
		this._prop = prop;
		this._path = path;
	}
	Proxy.prototype = {
		_broadcastChange: function(type) {
			if (this._changeListener)
				this._changeListener.jsonPatch(type, this);
		},
		toString: function() {
			return this.path() + " : " + this.val();
		},
		val: function() {
			if (this._prop != undefined ) return this._obj[this._prop];
			return this._obj;
		},
		// property name
		prop: function() {
			return this._prop;
		},
		// path to the property
		path: function() {
			var r = this._path.join('.');
			if (this._prop != undefined ) r += "." + this._prop;
			return r;
		},
		set: function(val) {
			if (this._prop != undefined ) {
				this._broadcastChange('set');
				this._obj[this._prop] = val;
				return;
			}
			throw "Can't set root object";
		},
		insert: function(val) {
			if (this._obj instanceof Array) {
				this._obj.splice(this._prop, 0, val);
			}
			else
				this.set(val);
			this._broadcastChange('insert');
		},
		delete: function(val) {
			if (this._prop != undefined )
			{
				if (this._obj instanceof Array) {
					this._obj.splice(this._prop, 1);
				}
				else
					delete this._obj[this._prop];
				this._broadcastChange('delete');
			}
			else
				throw "Can't delete root object";
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
		// leaf, path ends, return found objects
		if (path_array.length == 1) {
			switch(path_array[0]) {
				case "$":
					el.push(new Proxy(obj, null, path_to_here));
					break;
				case "*":
						switch(getType(obj)) {
								case 'Array':
									for (var i = 0; i < obj.length; i++)
										el.push(new Proxy(obj, i, path_to_here));
									break;
								case 'Object':
									for (var propName in obj)
										if (obj.hasOwnProperty(propName))
											el.push(new Proxy(obj, propName, path_to_here));
									break;
								case 'Basic':
									throw "Nothing to traverse at" + path_to_here.join('.') + '.*';
									break;
						}
						break;
				default:
					if (options['ghost_props'] || obj.hasOwnProperty(path_array[0]))
						el.push(new Proxy(obj, path_array[0], path_to_here));
					break;
			}
		}
		else // branch, keep on traversing
		{
			switch(path_array[0]) {
			case "$":
				el = traverse(obj,
					path_array.slice(1),
					array_clone_push(path_to_here, path_array[0]),
					options);
				break;
			case "*": // * => traverse all leafs
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
				break;
			default: // everything else => follow property names
				var o2 = obj[path_array[0]];
				if (o2)
					el = traverse(o2,
						path_array.slice(1),
						array_clone_push(path_to_here, path_array[0]),
						options);
				break;
			}
		}
		return el;
	}

	// Transforms "$.a.b[3].c" into [ '$', 'a', 'b', '[3]', 'c' ]
	function canonical_path(path) {
		if (path === null || path === undefined)
			throw "path cannot be null";
		var p = path.replace(/\./g, ';'); // a.b => a;b
		p = p.replace(/\[/g, ';['); // p[2] => p;[2]
		p = p.replace(/\[([^\]]+)\]/g, "$1"); // [2] => 2
//		console.log(p);
		return p.split(';');
	}

	function last_prop(path) {
		var c = canonical_path(path);
		return c.length > 0 ? c[c.length -1] : null;
	}

	function queryPath(obj, path, options) {
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

	window.JsonPath = {
		query: queryPath,
		parsePath: canonical_path,	// returns parsed path as array
		lastProp: last_prop	// last property of the path
	};

})(this);

// JsonDiff
(function(scope) {

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

	function getArrayType(arry) {
		for (var i=0; i<arry.length; i++)
			if (getType(arry[i]) != 'Basic')
				return 'Object';
		return 'Basic';
	}

	function iterateObject(obj, callback) {
		switch(getType(obj)) {
			case 'Array':
				for (var i=0; i<obj.length; i++)
					callback(obj, i);
		}
	}

	function createSet(path, value) {
		return { op: 'set', path: path, args: value }
	}

	function createInsert(path, value) {
		return { op: 'insert', path: path, args: value}
	}

	function createDelete(path, value) {
		return { op: 'delete', path: path, args: null }
	}

	function createSwap(src, dest) {
		return { op: 'swap', path: src, args: dest}
	}

	function applyDiff(obj, diff) {
		switch(diff.op) {
			case 'set':
				var target = JsonPath.query(obj, diff.path, {'just_one': true, 'ghost_props': true});
				if (target)
					target.set(diff.args);
				else
					throw "Could not SET, target not found";
				break;
			case 'insert':
				var target = JsonPath.query(obj, diff.path, {'just_one': true, 'ghost_props': true});
				if (target)
					target.insert(diff.args);
				else
					throw "Could not INSERT, target not found";
				break;
			case 'delete':
				var target = JsonPath.query(obj, diff.path, {'just_one':true });
				if (target)
					target.delete();
				else
					throw "Could not DELETE, target not found";
				break;
			case 'swap':
				var src = JsonPath.query(obj, diff.path, {'just_one': true});
				var dest = JsonPath.query(obj, diff.args, {'just_one': true});
				if (src && dest) {
					var tmp = src.val();
					src.set(dest.val());
					val.set(tmp);
				}
				else
					throw "Could not SWAP"
						+ (src ? "" : diff.path + " not found ")
						+ (dest ? "" : diff.args + " not found ");
					break;
			default:
				throw "Unknown operation " + diff.op;
		}
	}

	function printDiff(diff) {
		if (diff instanceof Array)
			diff.forEach( function(d) { printDiff(d)});
		else
			console.log(diff.path, " ", diff.op, " ", diff.args);
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
					createSet( path + "." + p, newObj[p] ));
			});
		inBoth.forEach( function(p) {
			diff = diff.concat( jsonDiffHelper( oldObj[p], newObj[p], path + "." + p));
		});
		return diff;
	}

	function jsonArrayDiff(oldObj, newObj, path) {
		function jsPath(index) { return path + '[' + index + ']'};
		function indexOfAfter(arry, el, afterPoint) {
			for (var i=afterPoint; i< arry.length; i++)
				if (arry[i] == el)
					return i;
			return -1;
		}
		function swap(arry, i, j) {
			var tmp = arry[i];
			arry[i] = arry[j];
			arry[j] = tmp;
		}

		// algorithm:
		// stage 1: treat src/dest as sets, equilize them
		// - delete any extras in src
		// - add any extras in dest to src
		// stage 2: move elements to proper position

		// ex: src = [1,2,3,4], dest = [4,2,5]

		if (getArrayType(oldObj) != 'Basic' || getArrayType(newObj) != 'Basic')
			return jsonComplexArrayDiff(oldObj, newObj, path);

		var patch = [];
		var newSrc = [].concat(oldObj);
		var tmpDest = [].concat(newObj);
		// delete extras in oldObj
		for (var i=0; i< newSrc.length; i++) {
			var index = tmpDest.indexOf(newSrc[i]);
			if (index === -1) { // delete element missing from destination
				patch.push({ op: 'delete', path: jsPath(i)});
				newSrc.splice(i, 1);
				i -= 1;
			}
			else
				tmpDest.splice(index, 1);
		};
		// ex: newSrc is [2,4]
		tmpDest = [].concat(newObj);
		var dupSrc = [].concat(newSrc);
		// add extras in dest to src
		for (var i=0; i< newObj.length; i++) {
			var index = dupSrc.indexOf(newObj[i]);
			if (index == -1) {
				var insertLoc = i > newSrc.length ? newSrc.length : i;
				patch.push({op: 'insert', path: jsPath(insertLoc), args: newObj[i]});
				newSrc.splice(insertLoc, 0, newObj[i]);
			}
			else
				dupSrc.splice(index, 1);
		}
		// ex: newSrc is now [2,4,5], same length as dest (possibly shuffled)
		// move elements to proper position
		for (var i=0; i< newSrc.length; i++) {
			if (newSrc[i] != newObj[i]) {
				var swapFrom = indexOfAfter(newSrc, newObj[i], i);
				if (swapFrom == -1)
					throw "Unexpected error while planning a swap";
				patch.push({ op: 'swap', path: jsPath(i), args: jsPath(swapFrom)});
				swap(newSrc, i, swapFrom);
			}
		}
		// ex: oldObj and newObj should now be the same
		return patch;
	}
	function jsonComplexArrayDiff(oldObj, newObj, path)
	{
		var diff = [];
		for (var i=0; i < oldObj.length; i++)
		{
			var newPath = path + "." + i;
			if (i < newObj.length) {
				diff = diff.concat( jsonDiffHelper(oldObj[i], newObj[i], newPath));
			}
			else
				diff = diff.concat( createDelete(newPath, oldObj[i]));
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
			retVal = createSet(path, newObj, oldObj);
		else switch(oldType)
		{
			case 'Basic':
				if (newObj != oldObj)
					retVal = createSet(path, newObj, oldObj); break;
			case 'Array':
				retVal = jsonArrayDiff(oldObj, newObj, path); break;
			case 'Object':
				retVal = jsonObjectDiff(oldObj, newObj, path); break;
		}
		return retVal;
	}

	function jsonDiff(oldObj, newObj, options) {
		options = mergeOptions(options, {verbose: false});
		var diff = jsonDiffHelper(oldObj, newObj, "$");
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

	scope.JsonDiff = {
		'diff': jsonDiff,
		'patch': jsonPatch,
		'prettyPrint': printDiff
	}

})(window);


