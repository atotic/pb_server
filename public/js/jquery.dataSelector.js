/*
docs: http://jqueryplugins.blogspot.com/2009/05/jquery-data-selector-filter.html
source: http://code.google.com/p/jquerypluginsblog/
Copyright (c) <year>, Pim Jager
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
* Redistributions of source code must retain the above copyright
notice, this list of conditions and the following disclaimer.
* Redistributions in binary form must reproduce the above copyright
notice, this list of conditions and the following disclaimer in the
documentation and/or other materials provided with the distribution.
* The name Pim Jager may not be used to endorse or promote products
derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY Pim Jager ''AS IS'' AND ANY
EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL Pim Jager BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/
(function($){
	//We use a small helper function that will return true when 'a' is undefined (so we can do if(checkUndefined(data)) return false;
	//If we would continue with undefined data we would piss javascript off as we would be getting properties of an
	//non-exsitent object (ie typeof data === 'undefined'; data.fooBar; //throws error
	var checkUndefined = function(a) {
		return typeof a === 'undefined';
	}

	function parseQuery(query) {
		var parsed = {
			badSelector: false,
			selectType: '',
			dataNameSplitted: [],
			compareValue: false
		};
		if (checkUndefined(query)) {
			parsed.badSelector = "undefined data query";
			return parsed;
		}
		var querySplitted = query.split('=');
		var selectType = querySplitted[0].charAt( querySplitted[0].length-1 );

		if(selectType == '^' || selectType == '$' || selectType == '!' || selectType == '*') {
			querySplitted[0] = querySplitted[0].substring(0, querySplitted[0].length-1);
			//the ^=, *= and $= are only available when the $.stringQuery plugin is loaded, if it is not and any of these are used we return false
			if(!$.stringQuery && selectType != '!')
				parsed.badSelector = "^=, *= and $= are only available when the $.stringQuery plugin is loaded";
		}
		else
			selectType = '=';

		var dataName = querySplitted[0]; //dataKey or dataKey.innerDataKey
		//Now we go check if we need dataKey or dataKey.innerDataKey
		var dataNameSplitted = dataName.split('.');

		parsed.dataNameSplitted = dataNameSplitted;
		parsed.selectType = selectType;
		parsed.compareValue = querySplitted[1];
		if (parsed.badSelector)
			console.warn(parsed.badSelector);
		return parsed;
	}

	function processQuery(elem, query) {
		if (checkUndefined(elem) || checkUndefined(query) || query.badSelector)
			return false;
		var data = $.data(elem, query.dataNameSplitted[0]);
//		var data = $(elem).data(query.dataNameSplitted[0]);
		if(checkUndefined(data))
			return false;
		if(query.dataNameSplitted[1]){//We have innerDataKeys
			for(i=1, x=query.dataNameSplitted.length; i<x; i++){ //we start counting at 1 since we ignore the first value because that is the dataKey
				data = data[query.dataNameSplitted[i]];
				if(checkUndefined(data))
					return false;
			}
		}
		if(query.compareValue){ //should the data be of a specified value?
			var checkAgainst = (data+'');
				//We cast to string as the query will always be a string, otherwise boolean comparison may fail
				//beacuse in javaScript true!='true' but (true+'')=='true'
			//We use this switch to check if we chould check for =, $=, ^=, !=, *=
			switch(query.selectType){
				case '=': //equals
					return checkAgainst == query.compareValue;
				break;
				case '!': //does not equeal
					return checkAgainst != query.compareValue;
				break;
				case '^': //starts with
					return $.stringQuery.startsWith(checkAgainst, query.compareValue);
				break;
				case '$': //ends with
					return $.stringQuery.endsWith(checkAgainst, query.compareValue);
				break;
				case '*': //contains
					return $.stringQuery.contains(checkAgainst, query.compareValue);
				break;
				default: //default should never happen
					console.log("blah");
					return false;
				break;
			}
		}

		else{ //the data does not have to be a speciefied value
				//, just return true (we are here so the data is specified, otherwise false would have been returned by now)
			return true;
		}
	}

	var version = $().jquery.match(/(\d+)\.(\d+)/);	// major: version[1], minor version[2]

	if (version[1] == "1" && parseInt(version[2]) < 8) {
		$.expr[':'].data = function(elem, count, params) {
			var query = parseQuery(params[3]);
			return processQuery(elem, query);
		};
	}
	else {	// jquery 1.8 & above
		$.expr[':'].data = $.expr.createPseudo(function(selector, context, xml) {
			var query = parseQuery(selector);
			return function(elem) {
				return processQuery(elem, query);
			};
		});
	}
})(jQuery);
