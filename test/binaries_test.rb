#! rake test:functional TEST=test/binaries_test.rb

require 'test/unit'
require_relative '../config/settings'
require 'json'

class BinarySettingsTest < Test::Unit::TestCase
	def test_binary_existence
		assert(File.exist?(SvegSettings.chrome_binary), "Chrome binary not found")
		assert(File.exist?(SvegSettings.chrome_dir), "Chrome launch directory not found")
		assert(File.exist?(SvegSettings.chrome_profile_dir), "Chrome profile directory not found")
		assert(File.exist?(SvegSettings.pdf_toolkit_binary), "pdftk binary not found")
		assert(File.exist?(SvegSettings.convert_binary), "convert binary not found")
		assert(File.exist?(SvegSettings.graphicsmagick_binary), "graphicsmagick_binary not found")
		assert(File.exist?(SvegSettings.exiv2_binary), "exiv2_binary not found")
		assert(File.exist?(SvegSettings.python_binary), "python_binary not found")
	end

	def test_opencv
		test_jpg = File.join(SvegSettings.root_dir, 'face_detect', 'test1.jpg')
		cmd_line = "#{SvegSettings.python_binary} #{SvegSettings.face_script} #{test_jpg}"
		faces = `#{cmd_line}`
		JSON.parse(faces)
	end
end
