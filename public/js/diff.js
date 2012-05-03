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

	function traverse(obj, path_array, path_to_here) {
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
				if (obj.hasOwnProperty(path_array[0]))
					el.push(new encapsulator(obj, path_array[0], path_to_here));
			}
		}
		else // branch, keep on traversing
		{
			if (path_array[0] == "$") {
				el = traverse(obj, path_array.slice(1), array_clone_push(path_to_here, path_array[0]));
			}
			else if (path_array[0] == "*") {
				switch(getType(obj)) {
					case 'Array':
						var trim_path = path_array.slice(1);
						for (var i=0; i < obj.length; i++) {
							el = el.concat( 
								traverse(obj[i], trim_path, array_clone_push(path_to_here, i)));
						}
						break;
					case 'Object':
						var trim_path = path_array.slice(1);
						for (var propName in obj)
							if (obj.hasOwnProperty(propName))
								el = el.concat(
									traverse(obj[propName], trim_path, array_clone_push(path_to_here, propName)));
						break;
					case 'Basic':
						throw 'nothing to traverse at' + path_to_here.join('.') + ".*";
				}
			}
			else {
				var o2 = obj[path_array[0]];
				if (o2)
					el = traverse(o2, path_array.slice(1), array_clone_push(path_to_here, path_array[0]));
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

	function jsonPath(obj, path) {
		if (!obj || !path) throw "Empty object or path";
		c_path = canonical_path(path);
		return traverse(obj, c_path, []);
	}

	window.JsonPath = jsonPath;
})(this);

Diff = {

	getType: function (obj) {
		if (obj instanceof Array)
			return 'Array';
		else if (obj instanceof Object)
			return 'Object';
		else
			return 'Basic';
	},

	makeReplace: function(path, value) {
		return {
			'type': 'replace',
			'path': path,
			'args': value
		}
	},
	applyOperation: function(operation, obj) {
		switch(operation.type) {
			case 'replace': 
				JsonPath.set(obj, operation.path, operation.args);
				break;
			default:
				throw "Unknown operation " + operation.type;
		}
	},
	// Return patch to turn oldObj into newObj
	// path is an xpath to left|right objects
	jsonDiff: function(oldObj, newObj, path) {
		path = path || "$";
		var oldType = Diff.getType(oldObj);
		var newType = Diff.getType(newObj);
		if (oldType != newType)
			return makeReplace(path, newObj);
		else

	},

	// Returns new obj when 
	jsonPatch: function (obj, patch) {

	}
}

console.log("yellow");

/*
# algorithm

Requirement: acceptable performance on photobook use cases.

- generate raw insert/delete/update diff. Update has an implicit delete
- compare the insert with deletes. If they match, replace with move
  - tricky: if insert/delete can be replaced with move/update. (happens when page is edited, then moved)

# Operations

- insert
- delete
- update (has implicit deletion)
- move
- array-delete (moves the rest of the items)
- array-insert (location where inserted item will be)

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
 $.0, 'array-delete'
 new = [a,c] // 

## Example 2c: 'Array'. item inserted
new = [a,a1,b,c]
diff:
	$.1, 'array-insert', 'a1'


What to do when arrays and objects are members of other arrays/objects.
The options are:
- treat objects as a single thing.
  pros: simple
  cons: horrendous performance, change of a single attribute regenerates the whole hierarchy
- 


*/