# rake test:functional TEST=test/json_diff_test.rb
require 'test/unit'
require 'rack/test'
require_relative "helper"
require_relative '../config/settings'
require_relative '../config/db'
require_relative '../lib/sveg_lib'
require_relative '../lib/sveg/json_diff'

require 'JSON'

require_relative '../config/debug'

class JsonPathTest < Test::Unit::TestCase

	def setup
		@simple_object = {'a' => "a", 'b' => "b", 'c' => "c"}
	end

	def myclone(o)
		Marshal.load( Marshal.dump(o))
	end

	def test_simple_object
		@simple_object = {:a => "a", :b => "b", :c => "c"}
		@simple_object = JSON.parse(JSON.generate @simple_object)

		result = PB::JsonPath.query(@simple_object, "$.a")
		assert(result.length == 1, "simple prop exists")
		result = PB::JsonPath.query(@simple_object, "$.d")
		assert(result.length == 0, "simple prop does not exist")
		result = PB::JsonPath.query(@simple_object, "$.*")
		assert(result.length == 3, "simple wildcard query")
	end

	def test_simple_array
		@simple_array = [1,2,3]
		result = PB::JsonPath.query(@simple_array, "$.0")
		assert(result.length == 1, "simple array exists")
		assert(result[0].val == 1, "correct value retrieved")
		result[0].insert("new val")
		assert(@simple_array[0].eql? "new val")
	end

	def test_complex_object
		@complex_object = {:a => {:a1=>"a1"}, b: [1,2,3], c: {:c1 => [1,2,3]}}
		@complex_object = JSON.parse(JSON.generate @complex_object)

		# existing properties
		result = PB::JsonPath.query(@complex_object, "$.a.a1")
		assert(result.length == 1, "complex object $.a.a1")
		result = PB::JsonPath.query(@complex_object, "$.b.0")
		assert(result.length == 1, "complex object $.b.0")
		result = PB::JsonPath.query(@complex_object, "$.c.c1[0]")
		assert(result.length == 1, "complex object $.c.c1[0]")
		assert(result[0].val == 1)

		# non-existent
		result = PB::JsonPath.query(@complex_object, "$.a.a2")
		assert(result.length == 0, "complex object nonexistent $.a.a2")

		# interesting selectors
		result = PB::JsonPath.query(@complex_object, "$.*")
		assert(result.length == 3, "complex, $.*")
		result = PB::JsonPath.query(@complex_object, "$.b.*")
		assert(result.length == 3, "complex array $.b.*")
	end

	def test_1
		json =
<<-eos
{ "title": "Test 1",
	"photoList": ["A","B","C","D", "E"],
	"photos": {
		"A": { "url": { "l": "/assets/test/1.jpg"} },
		"B": { "url": { "l": "/assets/test/2.jpg"} },
		"C": { "url": { "l": "/assets/test/3.jpg"} },
		"D": { "url": { "l": "/assets/test/4.jpg"} },
		"E": { "url": { "l": "/assets/test/5.jpg"} }
		},
	"pageList": ["cover", "cover-flap", "back-flap", "back","1","2","3","4"],
	"pages": {
		"cover": { "photoList": [] },
		"cover-flap": { "photoList": [] },
		"back-flap": { "photoList": [] },
		"back": {"photoList": [] },
		"1": {"photoList": ["A", "B"] },
		"2": {"photoList": ["B", "C"] },
		"3": {"photoList": ["D"] },
		"4": {"photoList": [] }
	}
}
eos
		obj = JSON.parse(json)
		diff = [{"op"=>"insert", "path"=>"$.pages.back.photoList[0]", "args"=>"A"}, {"op"=>"delete", "path"=>"$.pages.1.photoList[0]"}]
		o = PB::JsonDiff.patch(obj, diff)
	end

	def test_swap
		debugger
		document = JSON.parse '{"title":"testBook","photoList":[],"pageList":["cover","cover-flap","back-flap","back","dWAsZT","k6djRY","34WSlh","17caHV","hXtaSp","973tJZ"],"pages":{"cover":{"id":"cover","photoList":[]},"cover-flap":{"id":"cover-flap","photoList":[]},"back-flap":{"id":"back-flap","photoList":[]},"back":{"id":"back","photoList":[]},"dWAsZT":{"id":"dWAsZT","photoList":[]},"k6djRY":{"id":"k6djRY","photoList":[]},"34WSlh":{"id":"34WSlh","photoList":[]},"17caHV":{"id":"17caHV","photoList":[]},"hXtaSp":{"id":"hXtaSp","photoList":[]},"973tJZ":{"id":"973tJZ","photoList":[]}}}'
		diff = JSON.parse '[{"op":"swapArray","path":"$.pageList","args":{"srcIndex":5,"destIndex":4,"srcVal":"dWAsZT","destVal":"k6djRY"},"localId":"63wEK7"},{"op":"swapArray","path":"$.pageList","args":{"srcIndex":6,"destIndex":5,"srcVal":"dWAsZT","destVal":"34WSlh"}},{"op":"swapArray","path":"$.pageList","args":{"srcIndex":7,"destIndex":6,"srcVal":"dWAsZT","destVal":"17caHV"}},{"op":"swapArray","path":"$.pageList","args":{"srcIndex":8,"destIndex":7,"srcVal":"dWAsZT","destVal":"hXtaSp"}},{"op":"swapArray","path":"$.pageList","args":{"srcIndex":9,"destIndex":8,"srcVal":"dWAsZT","destVal":"973tJZ"}}]'
		PB::JsonDiff.patch(document, diff);
	end

end
