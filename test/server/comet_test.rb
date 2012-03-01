# bin/rake test:server TEST=test/server/comet_test.rb
require 'config/settings'
require 'config/db'
require 'test/unit'

require "rack/test"
require "comet"
require 'test/helper'

# monkeypatch for async responses
module Rack
  class MockSession
    def complete_request(response)
      status, headers, body = response
      @last_response = MockResponse.new(status, headers, body, @last_request.env["rack.errors"].flush)
      return if status == -1
      body.close if body.respond_to?(:close)
      # cookie_jar.merge(last_response.headers["Set-Cookie"], uri)
      @after_request.each { |hook| hook.call }
      if @last_response.respond_to?(:finish)
        @last_response.finish
      else
        @last_response
      end
    end
    
    def request(uri, env)
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
    @session.get "/test" { |r| assert r.status == 200, "Server down?" }
  end
  
  def test_AAA_subscribe
    user = create_user("atotic")
    book = create_book({:title => "Subscribe test"})
    
    mock_session1 = Rack::MockSession.new($Comet)
    session1 = Rack::Test::Session.new(mock_session1)
    async_get(session1, mock_session1, "/subscribe/book/#{book['id']}")
    assert session1.last_request.status == 200, "subscribe should be legal"

    mock_session2 = Rack::MockSession.new($Comet)
    session2 = Rack::Test::Session.new(mock_session2)
    async_get(session2, mock_session2, "/subscribe/book/#{book['id']}")
    
    # start session2
    # broadcast on book with session1 id, see if it shows in session2
    # broadcast on book with session2 id, see if it shows in session1
  end
  
  def test_errors
    # broadcast on non-existent book
    # broadcast non-existent message
  end
end