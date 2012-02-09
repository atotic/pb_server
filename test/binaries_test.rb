#! bin/rake test:all TEST=test/binaries_test.rb
ENV['RACK_ENV'] = 'test'
require 'config/settings'
require 'test/unit'

class BinarySettingsTest < Test::Unit::TestCase
  def test_chrome_binary
    assert(File.exist?(SvegSettings.chrome_binary), "Chrome binary not found")
    assert(File.exist?(SvegSettings.chrome_dir), "Chrome launch directory not found")
    assert(File.exist?(SvegSettings.chrome_profile_dir), "Chrome profile directory not found")
    assert(File.exist?(SvegSettings.pdf_toolkit_binary), "pdftk binary not found")
  end
end
