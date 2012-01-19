# rake test:all TEST=test/book_test.rb

require 'test/unit'
require 'rack/test'
require "test/helper"
require "model/book"
require "model/book_template"

class BookTest < Test::Unit::TestCase
	include Rack::Test::Methods
	include TestHelpers
	
	def test_book_templates
		Dir.foreach(SvegSettings.templates) do |template_name|
			next if template_name.start_with? "."
			next unless File.directory?( File.join(SvegSettings.templates, template_name));
			t = PB::BookTemplate.new(template_name)
			assert_not_nil t
			t.get_default_pages
		end
	end

	def test_book_creation
		user = create_user "book_owner"
		params = { "title" => "test book", "template" => {"template_name" => "6x6" } }
		template = PB::BookTemplate.get(params["template"]);
		book = template.create_book(user, params);
		book.save
		assert_not_nil book
		assert_not_nil(PB::Book.first);
		
	end
	
	def test_book_properties
		user = create_user "blah"
		params = { "title" => "test book" }
		b = PB::Book.new(user, params);
		b.save
		params["template"] = { "a" => "b", "c" => "d"}
		b = PB::Book.new(user, params)
		b.save
	end
end