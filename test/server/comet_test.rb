# bin/rake test:server TEST=test/server/comet_test.rb


require 'test/unit'
require "rack/test"

require_relative '../helper'
require_relative '../../config/settings'
require_relative '../../config/db'
require_relative '../../lib/sveg_lib'
require_relative '../../comet'

# monkeypatch for async responses
module Rack
	class MockSession
		def complete_request(response)
			status, headers, body = response
			debugger if (body.nil? || headers.nil?)
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
		PB.logger.level = Log4r::FATAL
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

	def test_atest
		mock_session = Rack::MockSession.new(Comet)
		session = Rack::Test::Session.new(mock_session)
		session.get "/test" do |r| 
			assert r.status == 200, "Server down?" 
		end
		login_user(@user, mock_session)
	end
	
	def create_async_subscribe_session(user, book)
		mock_session = Rack::MockSession.new(Comet)
		login_user(@user, mock_session)
		session = Rack::Test::Session.new(mock_session)
		async_get(session, mock_session, "/subscribe/book/#{book.pk}")
		assert session.last_response.status == 200, "subscribe should be legal"
		session
	end

	def test_subscribe_broadcast
		session1 = create_async_subscribe_session(@user, @book)
		assert session1.last_response.status == 200, "subscribe should be legal"
		session1_id = session1.last_response.body.match(/^([^\;]+)/)[1]

		session2 = create_async_subscribe_session(@user, @book)
		assert session2.last_response.status == 200, "subscribe should be legal"
		session2_id = session2.last_response.body.match(/^([^\;]+)/)[1]

		control_mock_session = Rack::MockSession.new(Comet)
		control_session = Rack::Test::Session.new(control_mock_session)
		# control_session does not need login, broadcasting is not protected

	# simple broadcast is received by both sessions
		@book.pages[0].update({:html => "COMMAND1"})
		cmd = ::PB::BrowserCommand.createReplacePageCmd(@book.pages[0])
		control_session.get("/broadcast/#{cmd.pk}")
		assert session1.last_response.body.include? "COMMAND1"
		assert session2.last_response.body.include? "COMMAND1"

	# broadcast on session1 is received by session2, but not session1
		@book.pages[0].update({:html => "COMMAND2"})
		cmd = ::PB::BrowserCommand.createReplacePageCmd(@book.pages[0])
		control_session.get("/broadcast/#{cmd.pk}?exclude=#{session1_id}")
		assert !(session1.last_response.body.include? "COMMAND2")
		assert session2.last_response.body.include? "COMMAND2"

	# broadcast on session2 is received by session1, not session2
		@book.pages[0].update({:html => "COMMAND3"})
		cmd = ::PB::BrowserCommand.createReplacePageCmd(@book.pages[0])
		control_session.get("/broadcast/#{cmd.pk}?exclude=#{session2_id}")
		assert session1.last_response.body.include? "COMMAND3"
		assert !(session2.last_response.body.include? "COMMAND3")

	end

	# try creating each different commands
	def test_create_commands

	end
	
	def test_errors
		mock_session = Rack::MockSession.new(Comet)		

		session = Rack::Test::Session.new(mock_session)
		async_get(session, mock_session, "/subscribe/book/#{@book.pk}")
		assert session.last_response.status == 401, "Unauthorized access"

		# non existent subscribe fail
		login_user(@user, mock_session)
		async_get(session, mock_session, "/subscribe/book/70000")
		assert session.last_response.status == 404, "Book not found"

		# non existent broadcast fail
		session.get("/broadcast/50000")
		assert session.last_response.status == 404, "No such command"
	end
end