# http://glu.ttono.us/articles/2005/10/30/why-and-how-ruby-and-rails-unit-testing
# http://en.wikibooks.org/wiki/Ruby_Programming/Unit_testing

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