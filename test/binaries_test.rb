#! rake test:functional TEST=test/binaries_test.rb

require 'test/unit'
require_relative '../config/settings'

class BinarySettingsTest < Test::Unit::TestCase
	def test_chrome_binary
		assert(File.exist?(SvegSettings.chrome_binary), "Chrome binary not found")
		assert(File.exist?(SvegSettings.chrome_dir), "Chrome launch directory not found")
		assert(File.exist?(SvegSettings.chrome_profile_dir), "Chrome profile directory not found")
		assert(File.exist?(SvegSettings.pdf_toolkit_binary), "pdftk binary not found")
		assert(File.exist?(SvegSettings.convert_binary), "convert binary not found")
		assert(File.exist?(SvegSettings.graphicsmagick_binary), "graphicsmagick_binary not found")
		assert(File.exist?(SvegSettings.exiv2_binary), "exiv2_binary not found")
	end
end
