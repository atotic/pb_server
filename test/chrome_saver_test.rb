# bin/rake test:all TEST=test/chrome_saver_test.rb
require 'ruby-debug'
Debugger.settings[:autoeval] = true

require "settings"
require 'test/unit'

require "rack/test"
require 'svegutils'
require "log4r"
LOGGER = Log4r::Logger.new 'chrome_saver_test'
LOGGER.add Log4r::FileOutputter.new("debug.log", :filename => File.join(SvegSettings.log_dir, 'chrome_saver_debug.log'))
LOGGER.add Log4r::Outputter.stdout

LOGGER.info "chrome_saver_test started"

# Exercises http API for pdf_saver_server.rb
class ChromeSaverTest < Test::Unit::TestCase

  def setup
    PB::ChromePDFTask.destroy
    # launch chrome
    @chrome_pid = PB::CommandLine.launch_chrome
    # launch pdf_saver_server
    @pdf_saver_pid = PB::CommandLine.launch_pdf_saver
  end
  
  def teardown
    Process.kill("TERM", @chrome_pid)
    Process.kill("TERM", @pdf_saver_pid)
  end

  def make_task(pdf_file=nil, html_file=nil)
    pdf_file = File.join(SvegSettings.data_dir,"chrome_saver_page1.pdf") unless pdf_file
    html_file = File.join(SvegSettings.test_dir, "public", "page1.html" ) unless html_file
    task = PB::ChromePDFTask.new({
      :html_file => html_file,
    	:pdf_file => pdf_file,
    	:book_id => 1,
    	:html_file_url => "file://" + html_file,
    	:pageWidth => 480,
    	:pageHeight => 480
    })
    # 72 page width points are 1in
    # 96 display points are 1in 
    assert task.valid?, "Task validation failed, #{task.errors.collect{|x| x.to_s}.to_s}"
    task.save
    task
  end

  def test_pdf_conversion
    pdf1 = File.join(SvegSettings.data_dir,"chrome_saver_page1.pdf")
    pdf2 = File.join(SvegSettings.data_dir,"chrome_saver_page2.pdf")
    File.delete(pdf1) if File.exist?(pdf1)
    File.delete(pdf2) if File.exist?(pdf2)
    html1 = File.join(SvegSettings.test_dir, "public", "page1.html" )
    html2 = File.join(SvegSettings.test_dir, "public", "page2.html" )
    task = make_task(pdf1, html1)
    task2 = make_task(pdf2, html2)
    assert !PB::ChromePDFTask.all.empty?, "The task is not there"
    # task will be served by pdf_saver_server, converted by chrome, and saved by pdf_saver_server
    timeout = 600
    begin
      Timeout.timeout(timeout) do
        n = PB::ChromePDFTask.count(:processing_stage.not => PB::ChromePDFTask::STAGE_DONE ) 
        LOGGER.info "Waiting for #{n} tasks"
        PB::ChromePDFTask.all.each do |t|
            LOGGER.warn "Task #{t.id} #{t.processing_stage}"
        end if n == 0
        while PB::ChromePDFTask.count(:processing_stage.not => PB::ChromePDFTask::STAGE_DONE ) != 0 do
          n = PB::ChromePDFTask.count(:processing_stage.not => PB::ChromePDFTask::STAGE_DONE ) 
          LOGGER.info "Waiting for #{n} tasks"
          assert !PB::ChromePDFTask.all.empty?, "The task has disappeared" if PB::ChromePDFTask.all.empty?
          Kernel.sleep(1)
        end
      end
    rescue Timeout::Error => e
      assert false, "pdf page did not convert after #{timeout} seconds"
    end
    task.reload
    task2.reload
    while task.processing_stage.nil? || task2.processing_stage.nil? do
      LOGGER.warn("task processing stage was nil")
      task.reload
      task2.reload
    end
    if (task.processing_stage != PB::ChromePDFTask::STAGE_DONE || task2.processing_stage != PB::ChromePDFTask::STAGE_DONE ) then 
      Kernel.sleep(3)
      task.reload; task2.reload;
      LOGGER.info("t1: #{task.processing_stage} t2: #{task2.processing_stage}")
      debugger
    end
    assert task.processing_stage == PB::ChromePDFTask::STAGE_DONE, "task not done #{task.processing_stage}"
    assert task2.processing_stage == PB::ChromePDFTask::STAGE_DONE, "task not done #{task2.processing_stage}"
    assert task.has_error == false, "Task did not convert to PDF, #{task.error_message}"
    assert task2.has_error == false, "Task2 did not convert to PDF, #{task2.error_message}"
    book_file = File.join(SvegSettings.data_dir, "book.pdf")
    cmd_line = PB::CommandLine.get_merge_pdfs(book_file, [pdf1, pdf2])
    success = Kernel.system cmd_line
    assert success, "Failed to merge PDF files"
   end
  
end
