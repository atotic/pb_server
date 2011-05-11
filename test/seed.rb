require File.dirname(__FILE__) + '/helper'

class SeedTestDb < Test::Unit::TestCase
	
  def test_seed
  	app
   	seed
  end
 
end
