require 'test/unit'
require 'rack/test'
require "test/helper"

class HelperTest < Test::Unit::TestCase
	include Rack::Test::Methods
	include TestHelpers
	
	def test_create_user
		create_user("atotic")
		assert_not_nil User.first(:display_name => "atotic"), "Could not log in"
	end
	
end