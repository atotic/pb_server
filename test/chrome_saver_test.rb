# bin/rake test:all TEST=test/chrome_saver_test.rb
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
                      "--no-sandbox",
                      :chdir => SvegSettings.chrome_profile_dir)
    # launch pdf_saver_server
    @pdf_saver_pid = Kernel.spawn({}, "bin/thin start -C pdf_saver_server.yml -e test")
    PB::ChromePDFTask.destroy
  end
  
  def teardown
    Process.kill("TERM", @chrome_pid)
    Process.kill("TERM", @pdf_saver_pid)
  end

  def make_task
    pdf_file = File.join(SvegSettings.data_dir,"chrome_saver_test_page1.pdf")
    html_file = File.join(SvegSettings.test_dir, "public", "page1.html" )
    task = PB::ChromePDFTask.new({
      :html_file => html_file,
    	:pdf_file => pdf_file,
    	:book_id => 1,
    	:html_file_url => "file://" + html_file,
    	:pageWidth => 600,
    	:pageHeight => 600
    })
    assert task.valid?, "Task validation failed, #{task.errors.collect{|x| x.to_s}.to_s}"
    task.save
    task
  end

  def test_pdf_conversion
    task = make_task
    assert !PB::ChromePDFTask.all.empty?, "The task is not there"
    # task will be served by pdf_saver_server, converted by chrome, and saved by pdf_saver_server
    timeout = 600

    begin
      Timeout.timeout(timeout) do
        while task.processing_stage != PB::ChromePDFTask::STAGE_DONE do
          task.reload
          assert !PB::ChromePDFTask.all.empty?, "The task has disappeared" if PB::ChromePDFTask.all.empty?
          Kernel.sleep(1)
        end
      end
    rescue Timeout::Error => e
      assert false, "pdf page did not convert after #{timeout} seconds"
    end
    assert task.processing_stage == PB::ChromePDFTask::STAGE_DONE, "pdf convertsion took more than 60 seconds, timed out at stage #{task.processing_stage}"
    assert task.has_error == false
   end
  
end
