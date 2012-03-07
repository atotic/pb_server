# bin/rake test:all TEST=test/create_sample_data.rb
require 'test/unit'
require 'rack/test'
require "test/helper"
require 'config/settings'
require 'config/db'
require "app/book"
require "app/book_template"

# book model tests
class CreateSampleData < Test::Unit::TestCase
	include TestHelpers
	
	def setup
  end
  
  def test_create_books
    book1 = create_book( :title => "Book1", :img_cnt => 10)
    assert book1, "Could not create book"
    book2 = create_book( :title => "Book1", :img_cnt => 10)
  end
end