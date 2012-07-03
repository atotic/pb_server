# bin/rake test:functional TEST=test/json_diff_test.rb
require 'test/unit'
require 'rack/test'
require_relative "helper"
require_relative '../config/settings'
require_relative '../config/db'
require_relative '../lib/sveg_lib'
require_relative '../lib/sveg/json_diff'

require 'JSON'

# book model tests
class BookTest < Test::Unit::TestCase
	include TestHelpers

	def setup
		@simple = {:a => "a", :b => "b", :c => "c"}
	end

	def test_json_path
		result = JsonPath.query(@simple, "$.a")
		assert_not_nil result
	end

	def test_book_creation
	end

	def test_book_properties
	end

end
