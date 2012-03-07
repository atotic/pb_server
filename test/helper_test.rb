# bin/rake test:all TEST=test/helper_test.rb
require 'test/unit'
require 'rack/test'
require "test/helper"

class HelperTest < Test::Unit::TestCase
	include TestHelpers

	def setup
  end
  
	def test_create_user
		create_user("atotic")
		assert_not_nil PB::User[:display_name => "atotic"], "Could not log in"
	end
	
end