# bin/rake test:functional TEST=test/helper_test.rb
require 'test/unit'
require 'rack/test'
require_relative "helper"

class HelperTest < Test::Unit::TestCase
	include TestHelpers

	def setup
	end

	def test_create_user
		create_user("atotic")
		assert_not_nil PB::User[:display_name => "atotic"], "Could not log in"
	end

	def test_login_user
		u = create_user("atotic")
		session = Rack::MockSession.new(nil)
		login_user(u, session)
		
	end
	
end