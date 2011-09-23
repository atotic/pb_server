# rake test:all TEST=test/book_test.rb

require 'test/unit'
require 'rack/test'
require "test/helper"
require "model/book"

class BookTest < Test::Unit::TestCase
	include Rack::Test::Methods
	include TestHelpers
	
	def test_book_templates
		Dir.foreach(PB::SvegApp.templates) do |template_name|
			next if template_name.start_with? "."
			next unless File.directory?( File.join(PB::SvegApp.templates, template_name));
			t = PB::BookTemplate.new( { "style" => template_name })
			assert_not_nil t
			t.get_default_pages
		end
	end

	def test_book_creation
		user = create_user "book_owner"
		book = PB::Book.new(user, { "title" => "test book"}, { "style" => "6x6"});
		assert_not_nil book
		book.init_from_template
		book.save
		assert_not_nil(PB::Book.first);
	end
end