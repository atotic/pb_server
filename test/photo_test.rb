# RACK_ENV=test rake test:functional TEST=test/photo_test.rb
require 'test/unit'
require 'rack/test'
require_relative "helper"
require_relative '../config/settings'
require_relative '../config/db'
require_relative '../lib/sveg_lib'

require_relative '../config/debug'

class PhotoTest < Test::Unit::TestCase
	include TestHelpers

	def test_env
		assert(SvegSettings.test? == true, "Functional tests must be run in test environment");
	end

	def test_exif_parse
		f = File.expand_path('test/public/test-1.jpg')
		assert(File.exist?( f), "Could not find test file")
		exif = PB::PhotoStorage.read_exif_data(f)
		assert( ( exif[:date_time_original].eql?("2011:05:01 12:30:23")), "date_time_original");
		assert( exif[:date_time].eql?("2011:05:10 21:09:58"), "date_time")
		assert( exif[:description].eql?("Caption"), "description")
		assert( exif[:title].eql?("Title"), "title")
	end

	def test_get_size
		f = File.expand_path('test/public/test-1.jpg')
		width, height = PB::PhotoStorage.get_size(f)
		assert(width == 2000, "width")
		assert(height == 1500, "height")
	end

	def test_store_file
		src = File.expand_path('test/public/test-1.jpg')
		dest = File.expand_path('test/public/test-1-copy.jpg')
		`cp #{src} #{dest}`
		user = create_user('atotic')
		photo = PB::Photo.create( {:display_name => File.basename(src), :user_id => user.pk} )
		PB::PhotoStorage.store_file(photo, dest )

		assert_not_nil(photo.icon_file, "icon_file")
		assert(photo.icon_file_width != 0, "icon_file_width")
		assert(photo.icon_file_height != 0, 'icon_file_height')
		assert_not_nil(photo.display_file, 'display_file')
		assert(photo.display_file_width != 0, "display_file_width")
		assert(photo.display_file_height != 0, 'display_file_height')
		assert_not_nil(photo.original_file, 'original_file')
		assert(photo.original_file_width != 0, "original_file_width")
		assert(photo.original_file_height != 0, 'original_file_height')
	end
end
