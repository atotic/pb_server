# bin/rake test:server TEST=test/server/svegsession_test.rb

require 'test/unit'
require "rack/test"
require "test/helper"

require 'config/settings'
require 'config/db'
require 'svegutils'
require "log4r"
require 'rack-flash'
require 'app/user'

class TestServer 
	def call(env)
		case 
			when env['PATH_INFO'] =~ /^\/null$/
				[200, {}, ['ok']]
			when env['PATH_INFO'] =~ /^\/login\/(\d+)/
				u = PB::User[$~[1].to_i]
				u.login(env)
				[200, {}, ['logged in']]
			when env['PATH_INFO'] =~ /^\/logout/
				if env['sveg.user']
					PB::User.logout(env)
					[200, {}, ['logged out']]
				else
					[404, {}, ['no user to log out']]
				end
			when env['PATH_INFO'] =~ /^\/assert_user/
				if env['sveg.user']
					[200, {}, ['user found']] 
				else
					[404, {}, ['user not found']]
				end
			when env['PATH_INFO'] =~ /^\/make_flash/
				env['x-rack.flash'][:notice] = "here is some flash"
				env['x-rack.flash'][:error] = "flash error"
				[200, {}, ['made flash']]
			when env['PATH_INFO'] =~ /^\/show_flash/
				f = ""
				f += env['x-rack.flash'][:notice] || ""
				f += env['x-rack.flash'][:error] || ""
				if f.empty?
					[404, {}, ['no flash']]
				else
					[200, {}, ["flash is #{f}"]]
				end
			else
				[404, {}, ['not found']]
		end
	end
end

class SvegSessionTest < Test::Unit::TestCase
	include Rack::Test::Methods
	include TestHelpers

	def app
		unless @app
			@app = Rack::Builder.new do
					use Rack::Session::Cookie, {
						:key => 'rack.session',
						:coder => PB::SvegSessionCoder.new,
						:sidbits => 32,
						:skip => true,	# Rack > 1.4
						:defer => true, # Rack < 1.4
					}
					use Rack::Flash
					use PB::SvegSession
					run TestServer.new
				end
		end
		@app
	end

	def test_user
		u = create_user "atotic"
		get "/login/#{u.pk}"
		assert last_response.ok?, "/login"
		assert last_response['Set-Cookie']
		get "/assert_user"
		assert last_response.ok?, "/assert_user"
		get "/logout"
		assert last_response.ok?, "/logout"
		get "/assert_user"
		assert last_response.not_found?, "/assert_user not there"
		assert last_response['Set-Cookie'].nil?
	end

	def test_flash
		get "/make_flash"
		assert last_response.ok?
		assert last_response['Set-Cookie']
		get "/null" # no setting a cookie again
		assert last_response['Set-Cookie'].nil?
		get "/show_flash" # shows text inline, sets cookie to clear flash
		assert last_response.ok?, "/show_flash failed #{last_response.status} #{last_response.body}"
		assert last_response['Set-Cookie']
		get "/show_flash" # no more flash
		assert last_response.client_error?
		get "/make_flash" 
		get "/make_flash" # cookes already made, no new cookies
		assert last_response.ok?
		assert last_response['Set-Cookie'].nil?
		# xhr request returns flash in 
		get "/null", {}, {"HTTP_X_REQUESTED_WITH" => "XMLHttpRequest"}
		assert last_response['Set-Cookie']
		assert last_response['X-FlashError']
		assert last_response['X-FlashNotice']
		get "/show_flash" # no more flash
		assert last_response.client_error?
	end
end