# bin/rake test:server TEST=test/server/comet_test.rb
require 'config/settings'
require 'config/db'
require 'test/unit'

require "rack/test"
require "comet"

class CometServerTest < Test::Unit::TestCase

  def setup
    @session = Rack::Test::Session.new($Comet)
    assert SvegSettings.environment == :development, "Server tests must be run in development mode"
  end
  
  def test_test
    @session.get "/test" do
      |r| assert r.status == 200
    end
  end
  
  def test_subscribe
    
  end
end