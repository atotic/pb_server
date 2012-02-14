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
    DataMapper.finalize	  
  end
  
  def test_create_books
    user = create_user('atotic')
    template = PB::BookTemplate.new("modern_lines")
		book1 = template.create_book(user, {"title" => "Book1", "template"=>{"name"=>"modern_lines"}});
    assert book1
    book2 = template.create_book(user, {"title" => "Book2", "template"=>{"name"=>"modern_lines"}});
    assert book2
    Dir.glob(File.join(SvegSettings.root_dir, "test/public/*.jpg")).each do |filename|
      photo = PB::Photo.first(:display_name => File.basename(filename))
      unless photo
        newName = "#{filename}.jpg"
        `cp #{filename} #{newName}`
        photo = PB::Photo.create( {:display_name => File.basename(filename), :user_id => user['id']} );
				PB::PhotoStorage.storeFile(photo, newName )
      end
			book1.photos << photo
			book2.photos << photo
	  end
	  book1.save
	  book2.save
	  assert "All done"
  end
end