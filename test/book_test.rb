# bin/rake test:all TEST=test/book_test.rb
ENV['RACK_ENV'] = 'test'

require 'test/unit'
require 'rack/test'
require "test/helper"
require 'config/settings'
require 'config/db'
require "app/book"
require "app/book_template"

# book model tests
class BookTest < Test::Unit::TestCase
	include TestHelpers
	
	def setup
		PB::Book.destroy
	end
	
	def test_book_templates_dir
		Dir.foreach(SvegSettings.book_templates_dir) do |template_name|
			next if template_name.start_with? "."
			next unless File.directory?( File.join(SvegSettings.book_templates_dir, template_name));
			t = PB::BookTemplate.new(template_name)
			assert_not_nil t
			t.get_default_pages
		end
	end

	def test_book_creation
		user = create_user "book_owner"
		book_params = { :title => "test book" }
		template = PB::BookTemplate.get("6x6");
		book = template.create_book(user, book_params);
		book.save
		assert_not_nil book
		assert_not_nil(PB::Book.first);
	end
	
	def test_book_properties
		user = create_user "blah"
		params = { :user_id => user.pk, :title => "test book" }
		b = PB::Book.new(params);
		b.save
		params["template"] = { "a" => "b", "c" => "d"}
		b = PB::Book.new(params)
		b.save
	end
	
end