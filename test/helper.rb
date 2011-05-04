ENV['RACK_ENV'] = 'test'

require 'test/unit'
require 'rack/test'
require 'sveg'

Sinatra::Base.set :environment, :test

class Test::Unit::TestCase
  include Rack::Test::Methods

	def app
		SvegApp.new
	end
end