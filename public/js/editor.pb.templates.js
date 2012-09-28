// editor.pb.templates.js

(function(scope) {

var cache = {};

var	Template = {
	// Predefined ids:
	THEME_LIST: '_config-themes',

	// id => template, returns deferred that yields the result.
	// return: a deferred
	// deferred result is a map id => object, { id => <requested object>, id => <requested_object> }
	get: function(idOrIdArray)  { //takes <id> | [ id* ]
		if (idOrIdArray === null)
			throw "Template.get(id) id must not be null";

		var idList;
		if (typeof idOrIdArray == 'string')
			idList = [idOrIdArray];
		else
			idList = [].concat(idOrIdArray);

		var retVal = $.Deferred();

		if (idList.length == 0) {
			retVal.resolve({});
			return retVal;
		}

		var result = {};

		var missingIds = [];
		for (var i=0; i<idList.length; i++) {
			if (idList[i] in cache)
				result[ idList[i] ] = cache[ idList[i] ];
			else
				missingIds.push( idList[i] );
		}

		if (missingIds.length == 0) { // no need for network, we are good
			retVal.resolve(result);
			return retVal;
		}

		$.ajax({
			url: '/template/'+ missingIds.join(','),
			dataType: 'jsonp'
			})
			.done(function(response, msg, jqXHR) {
				for (var id in response) {
					Template.put(response[id]);
					result[id] = response[id];
				}
				retVal.resolve(result);
			})
			.fail(function(jqXHR, status, msg) {
				debugger;
				console.warn("template loading failed", status, msg);
				var retry = false;
				switch(status) {
					default:
						console.warn('template failed to load', status, msg);
				}
				retVal.reject(result);
			});
		return retVal;
	},
	put: function(template) {
		// TODO, initialize inheritance here
		cache[template.id] = template;
	}
}

scope.Template = Template;
})(PB);


/* TODO
1) assign book_template, theme template to book
does every book belong to single theme? Yes!
*/
var FamilyTheme = {
	id: '_test-family-theme',
	title: "Family",
	sample_images: ['_test-family-img_showcase1'],
	book_templates: ['_test-family-book_8x11']
}

var SimpleTheme = {
	id: '_test-simple-theme',
	title: "Simple",
	sample_images: ['_test-simple-img_showcase1'],
	book_templates: ['_test-simple-book_8x11']
}

//PB.Template.put(FamilyTheme);
//PB.Template.put(SimpleTheme);

var DummyBookSimple_8X11 = {
	id: 'book-_dummy_simple_8x11',
	title: 'Dummy Simple Book',
	width: 8,
	height: 11,
}

PB.Template.put(DummyBookSimple_8X11);

