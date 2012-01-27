require "settings"
require 'test/unit'

class HelperTest < Test::Unit::TestCase
  def test_chrome_binary
    assert(File.exist?(SvegSettings.chrome_binary), "Chrome binary nout found")
    assert(File.exist?(SvegSettings.chrome_dir), "Chrome launch directory not found")
    assert(File.exist?(SvegSettings.chrome_profile_dir), "Chrome profile directory not found")
    assert(File.exist?(SvegSettings.pdf_toolkit_binary), "pdftk binary not found")
  end
end
