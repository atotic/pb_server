// diff.js
/*
Comparing objects in javascript

Engineered to be a forgiving patch algorithm:
As forgiving as we can be without document corruption

Trying to delete something already gone: we ignore it
Trying to swap non-existent elements, ignore again
Etc, etc, as I fine tune it to real-world usage
patch format:
[
	{
		'path' : '', // jsonpath
		'op': 'set/delete/insert/arraySwap', //
		'args': // depends on op
	}
]
- set: obj[path] = args
	path: object to set
	args: value to set

- delete: 2 use cases:
	1) Deleting from an array by position, or value
		path: path to object inside an array
		args: optional value
		if args, delete object from array whose value is args
		else, delete object from array by index
	2)
		path: path to obj property
		args: nil
		deletes object property

- insert: 2 use cases
	1) inserts a new value inside an array
		path: path to object inside an array
		args: value
	2) inserts a new property in an object
		path: path to property
		args: value

- arraySwap: swaps two values in the array
	path: array path
	args:
		srcIndex:
		srcValue: can be null
		destIndex:
		destValue: can be null
	2 use cases:
		if no value, swap using index
		if value, use value to find index, then swap


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
		this._path = path;	// path is an array of [ [path part, object] ]
	}
	Proxy.prototype = {
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
		// jsonpath to the property
		path: function() {
			var r = this._path.map(function(x) { return x[0]}).join('.');
			if (this._prop != undefined ) r += "." + this._prop;
			return r;
		},
		// array of objects leading to property
		objectPath: function() {
			var op = this._path.map(function(x) { return x[1]});
			if (this._prop != undefined) op.push(this._prop);
			return op;
		},
		set: function(val) {
			if (this._prop != undefined ) {
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
		},
		delete: function(valToDelete) {
			if (this._prop != undefined )
			{
				if (this._obj instanceof Array) {
					var pos = this._prop;
					if (valToDelete == undefined)
						this._obj.splice(this._prop, 1);
					else {
						if (this._obj[pos] === valToDelete) // shortcut, so we do not search the array
							this._obj.splice(pos, 1);
						else {
							pos = this._obj.indexOf(valToDelete);
							if (pos != -1)
								this._obj.splice(pos, 1);
							else
								console.warn("jsonpatch.delete did not find value", this.path(), valToDelete);
						}
					}
				}
				else
					delete this._obj[this._prop];
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
					array_clone_push(path_to_here, [path_array[0], obj]),
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
									array_clone_push(path_to_here, [i, obj[i]]),
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
										array_clone_push(path_to_here, [propName, obj]),
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
						array_clone_push(path_to_here, [path_array[0], o2]),
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
		else if (typeof obj == 'function')
			throw "Cant diff functions";
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
		return { op: 'delete', path: path, args: value }
	}

	function createSwapArray(arrayPath, srcIndex, destIndex, srcVal, destVal) {
		return { op: 'swapArray', path: arrayPath, args: {
			srcIndex: srcIndex,
			destIndex: destIndex,
			srcVal: srcVal,
			destVal: destVal
			}
		}
	}

	function applyDiff(obj, diff, change_record) {
		switch(diff.op) {
			case 'set':
				var target = JsonPath.query(obj, diff.path, {'just_one': true, 'ghost_props': true});
				if (target) {
					if (change_record) change_record.push(['set', target]);
					target.set(diff.args);
				}
				else
					throw "Could not SET, target not found";
				break;
			case 'insert':
				var target = JsonPath.query(obj, diff.path, {'just_one': true, 'ghost_props': true});
				if (target) {
					if (change_record) change_record.push(['insert', target]);
					target.insert(diff.args);
				}
				else
					throw "Could not INSERT, target not found";
				break;
			case 'delete':
				var target = JsonPath.query(obj, diff.path, {'just_one':true });
				if (target) {
					if (change_record) change_record.push(['delete', target]);
					target.delete(diff.args);
				}
				else
					console.warn("Tried to delete nonexistent target", diff.path);
				break;
			case 'swapArray':
				var array = JsonPath.query(obj, diff.path, {'just_one': true});
				if (!array)
					throw "Could not swapArray " + diff.path;
				var srcPos = diff.args.srcIndex;
				var destPos = diff.args.destIndex;
				if ('srcValue' in diff.args && diff.args.srcValue != undefined)
					srcPos = array.val().indexOf(diff.args.srcValue);
				if ('destValue' in diff.args && diff.args.destValue != undefined)
					destPos = array.val().indexOf(diff.args.destValue);
				if (srcPos != -1 && destPos != -1) {
					src = JsonPath.query(obj, diff.path + "[" + srcPos + "]", {just_one:true});
					dest = JsonPath.query(obj, diff.path + "[" + destPos + "]", {just_one:true});
					if (src && dest) {
						var tmp = src.val();
						if (change_record) change_record.push(['set', src]);
						if (change_record) change_record.push(['set', dest]);
						src.set(dest.val());
						dest.set(tmp);
					}
					else
						throw "could not swapArray" + diff.path;
				}
				else
					console.warn("could not swapArray", diff.path, diff.args);
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
		// stage 1: treat src/dest as sets, make them have same elements
		// 	delete from src any elements not in dest
		//  add to src any extra dest elements
		// stage 2: move elements to proper position

		// ex: oldObj = [1,2,3,4], newObj = [4,2,5]

		if (getArrayType(oldObj) != 'Basic' || getArrayType(newObj) != 'Basic')
			return jsonComplexArrayDiff(oldObj, newObj, path);

		var patch = [];
		var src = oldObj.slice(0);
		var dest = newObj.slice(0);

		// delete items not in dest from src
		for (var i=0; i< src.length; i++) {
			var index = dest.indexOf(src[i]);
			if (index === -1) { // delete element missing from destination
				patch.push( createDelete( jsPath(i), src[i] ) );
				src.splice(i, 1);
				i -= 1;
			}
			else
				dest.splice(index, 1);
		};
		// src is: src - items not in dest
		// dest is: dest - items not in src

		// add items in dest to src
		for (var i=0; i< dest.length; i++) {
			var index = newObj.indexOf(dest[i]);
			if (index > src.length)
				index = src.length;
			src.splice(index, 0, dest[i]);
			patch.push( createInsert( jsPath(index), dest[i]));
		}

		// src contains all items in newObj, possibly in wrong order
		// sort them with swaps
		for (var i=0; i< src.length; i++) {
			if (src[i] != newObj[i]) {
				var swapFrom = indexOfAfter(src, newObj[i], i);
				if (swapFrom == -1)
					throw "Unexpected error while planning a swap";
				patch.push(createSwapArray(path, swapFrom, i, src[i], newObj[i]));
				swap(src, swapFrom, i);
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

	// Patches the object with diff.
	// Return: patched copy of the object
	// Return: [patched_copy, changes] if options.record_changes is true.
	//
	// Do not patch in place, because patch can fail half-way, leaving object inconsistent
	function jsonPatch(obj, diff, options) {
		options = mergeOptions(options, {record_changes: false})
		var newObj = JSON.parse(JSON.stringify(obj));
		var diff = JSON.parse(JSON.stringify(diff)); // clone the diff because we do not want to modify original diff
		var change_record = options.record_changes ? [] : null;
		for (var i =0; i< diff.length ; i++)
		{
			try {
				applyDiff(newObj, diff[i], change_record);
			}
			catch(e) {
				console.log("Patch failed " + e);
				printDiff(diff[i]);
				throw e;
			}
		}
		if (change_record)
			return [newObj, change_record];

		return newObj;
	}

	scope.JsonDiff = {
		'diff': jsonDiff,
		'patch': jsonPatch,
		'prettyPrint': printDiff
	}

})(window);


