# bin/rake test:server TEST=test/server/comet_test.rb
require 'config/settings'
require 'config/db'
require 'test/unit'
require "rack/test"
require 'test/helper'

require "comet"
require "app/command_stream"

# monkeypatch for async responses
module Rack
	class MockSession
		def complete_request(response)
			status, headers, body = response
			@last_response = MockResponse.new(status, headers, body, @last_request.env["rack.errors"].flush)
			return if status == -1
			body.close if body.respond_to?(:close)
			@cookie_jar.merge(last_response.headers["Set-Cookie"], @uri)
			@after_request.each { |hook| hook.call }
			if @last_response.respond_to?(:finish)
				@last_response.finish
			else
				@last_response
			end
		end
		
		def request(uri, env)
			@uri = uri
			env["HTTP_COOKIE"] ||= cookie_jar.for(uri)
			@last_request = Rack::Request.new(env)
			complete_request(@app.call(@last_request.env))
		end
		
	end
end
	
class CometServerTest < Test::Unit::TestCase
	include TestHelpers

	def setup
		assert SvegSettings.environment == :development, "Server tests must be run in development mode"
		@user = create_user("atotic")
		@book = create_book({:user => @user, :title => "Subscribe test"})
	end

	def teardown
		@book.destroy if @book
	end

	def process_event_loop
		EM.next_tick { EM.stop_event_loop }
		EM.run
	end
	
	def async_get(session, mock_session, uri, env={}, &block)
		env['async.callback'] = mock_session.method(:complete_request)
		env['async.close'] = ::EventMachine::DefaultDeferrable.new
		session.get(uri, {}, env)
		process_event_loop if session.last_response.status == -1
		yield session.last_response if block
		session.last_response
	end

	def test_test
		mock_session = Rack::MockSession.new(Comet)
		session = Rack::Test::Session.new(mock_session)
		session.get "/test" do |r| 
			assert r.status == 200, "Server down?" 
		end
		login_user(@user, mock_session)
	end
	
	def test_subscribe_broadcast
		mock_session1 = Rack::MockSession.new(Comet)
		login_user(@user, mock_session1)
		session1 = Rack::Test::Session.new(mock_session1)
		async_get(session1, mock_session1, "/subscribe/book/#{@book.pk}")
		assert session1.last_response.status == 200, "subscribe should be legal"

		mock_session2 = Rack::MockSession.new(Comet)
		# we could also transfer cookie jar from mock_session1
		login_user(@user, mock_session2)
		session2 = Rack::Test::Session.new(mock_session2)
		async_get(session2, mock_session2, "/subscribe/book/#{@book.pk}")

		control_mock_session = Rack::MockSession.new(Comet)
		# no login, broadcasting is not protected
		control_session = Rack::Test::Session.new(control_mock_session)

	# simple broadcast is received by both sessions
		@book.pages[0].update({:html => "COMMAND1"})
		cmd = ::PB::BrowserCommand.createReplacePageCmd(@book.pages[0])
		control_session.get("/broadcast/#{cmd.pk}")
		assert session1.last_response.body.include? "COMMAND1"
		assert session2.last_response.body.include? "COMMAND1"
	# broadcast on session1 is received by session2, but not session1
	# broadcast on session2 is received by session1, not session2

	# try creating each different commands
	end
	
	def test_errors
		# broadcast on non-existent book
		# broadcast non-existent message
	end
end