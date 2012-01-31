# bundle exec rake test:all TEST=test/chrome_saver_test.rb
require 'ruby-debug'
Debugger.settings[:autoeval] = true

require "settings"
require 'test/unit'

require "rack/test"
require "sfl"

# Exercises http API for pdf_saver_server.rb
class ChromeSaverTest < Test::Unit::TestCase

  def setup
    # launch chrome
    @chrome_pid = Kernel.spawn(SvegSettings.chrome_binary,
                      "--user-data-dir=#{SvegSettings.chrome_profile_dir}",
                      :chdir => SvegSettings.chrome_profile_dir)
    # launch pdf_saver_server
    @pdf_saver_pid = Kernel.spawn({'RACK_ENV' => 'test'}, "bin/thin", "start", "-C", "pdf_saver_server.yml")
  end
  
  def teardown
#    Process.kill("TERM", @chrome_pid)
    Process.kill("TERM", @pdf_saver_pid)
  end
  
  
  def test_wait_5_seconds
    Kernel.sleep(5)
  end

end
