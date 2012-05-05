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

/** 
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
*/

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

// JsonDiff
(function(window) {

	function getType(obj) {
		if (obj instanceof Array)
			return 'Array';
		else if (obj instanceof Object)
			return 'Object';
		else
			return 'Basic';
	}

	function createUpdate(path, value, oldValue) {
		var update =  {
			'type': 'update',
			'path': path,
			'args': value
		}
		var implicit_delete = {
			'type': 'implicit_delete',
			'path': path,
			'args': oldValue
		}
		return [update, implicit_delete];
	}

	function createInsert(path, value) {
		return [{
			'type': 'insert',
			'path': path,
			'args': value
		}]
	}

	function createDelete(path, value) {
		return [ {
			'type': 'delete',
			'path': path,
			'args': value
		}]
	}

	function applyDiff(obj, diff) {
		switch(diff.type) {
			case 'update':
				var target = JsonPath(obj, diff.path, {'just_one':true });
				if (target)
					target.set(diff.args);
				else
					throw "Could not UPDATE, target not found";
				break;
			case 'implicit_delete':
				break;
			case 'insert':
				var target = JsonPath(obj, diff.path, {'just_one': true, 'ghost_props': true});
				if (target)
					target.set(diff.args);
				else
					throw "Cound not INSERT, target not found";
				break;
			case 'delete':
				var target = JsonPath(obj, diff.path, {'just_one':true });
				if (target)
					target.delete();
				else
					throw "Could not DELETE, target not found";
				break;
			default:
				throw "Unknown operation " + diff.type;
		}
	}

	function printDiff(diff) {
		if (diff instanceof Array)
			diff.forEach( function(d) { printDiff(d)});
		else {
			console.log(diff.path, " ", diff.type, " ", diff.args);
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
				createDelete(path + "." + p));
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
		// TODO
	}
	function compressDiff(oldObj, newObj, diff)
	{
		return diff;
	}

	function jsonDiff(oldObj, newObj) {
		var diff = jsonDiffHelper(oldObj, newObj, "$");
		diff = compressDiff(oldObj, newObj, diff);
		return diff;
	}

	// Clones the object, applies diff
	function jsonPatch(obj, diff) {
		var newObj = JSON.parse(JSON.stringify(obj));
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