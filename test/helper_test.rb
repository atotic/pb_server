require 'test/unit'
require 'rack/test'
require "test/helper"

class HelperTest < Test::Unit::TestCase
	include TestHelpers

	def setup
	  DataMapper.finalize
  end
  
	def test_create_user
		create_user("atotic")
		assert_not_nil PB::User.first(:display_name => "atotic"), "Could not log in"
	end
	
end