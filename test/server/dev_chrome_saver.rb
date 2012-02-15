# bin/rake test:all TEST=test/dev_chrome_saver.rb
require 'ruby-debug'
Debugger.settings[:autoeval] = true
require 'test/unit'
require "rack/test"

OLD_RACK_ENV = ENV['RACK_ENV']
ENV['RACK_ENV'] = "development"
require 'config/settings'
require 'config/db'
require 'svegutils'
require "log4r"
require 'app/book2pdf_job'

DataMapper.finalize

LOGGER = Log4r::Logger.new 'chrome_saver_test'
LOGGER.add Log4r::FileOutputter.new("debug.log", :filename => File.join(SvegSettings.log_dir, 'chrome_saver_debug.log'))
LOGGER.add Log4r::Outputter.stdout

LOGGER.info "chrome_saver_test started"

# Exercises http API for pdf_saver_server.rb
class ChromeSaverTest < Test::Unit::TestCase

  def setup
    (assert false, "chrome_saver must be run in development environment") if OLD_RACK_ENV && OLD_RACK_ENV != 'development'
    # launch chrome
    `./script/chrome start`
    # launch pdf_saver_server
    `./script/pdf_saver_server start`
  end
  
  def teardown
    @task.destroy if @task
    @task2.destroy if @task2
  end

  def make_task(pdf_file, html_file, book_pdf)
    task = PB::ChromePDFTask.new({
      :book_dir => "",
      :book_pdf => book_pdf,
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
    book_pdf = File.join(SvegSettings.data_dir, "book.pdf")
    @task = make_task(pdf1, html1, book_pdf)
    @task2 = make_task(pdf2, html2, book_pdf)
    assert !PB::ChromePDFTask.all.empty?, "The task is not there"
    # task will be served by pdf_saver_server, converted by chrome, and saved by pdf_saver_server
    timeout = 600
    begin
      Timeout.timeout(timeout) do
        n = PB::ChromePDFTask.count(:processing_stage.not => PB::ChromePDFTask::STAGE_DONE ) 
        LOGGER.info "Waiting for #{n} tasks"
        while ((@task.processing_stage != PB::ChromePDFTask::STAGE_DONE) && (@task2.processing_stage != PB::ChromePDFTask::STAGE_DONE)) do
          n = PB::ChromePDFTask.count(:processing_stage.not => PB::ChromePDFTask::STAGE_DONE ) 
          LOGGER.info "Waiting for #{n} tasks"
          # assert !PB::ChromePDFTask.all.empty?, "The task has disappeared" if PB::ChromePDFTask.all.empty?
          Kernel.sleep(1)
          @task.reload;@task2.reload
        end
      end
    rescue Timeout::Error => e
      assert false, "pdf page did not convert after #{timeout} seconds"
    end
    @task.reload;@task2.reload
    while @task.processing_stage.nil? || @task2.processing_stage.nil? do
      LOGGER.warn("task processing stage was nil")
      @task.reload; @task2.reload
    end
    if (@task.processing_stage != PB::ChromePDFTask::STAGE_DONE || @task2.processing_stage != PB::ChromePDFTask::STAGE_DONE ) then 
      Kernel.sleep(3)
      @task.reload; @task2.reload;
      LOGGER.info("had to sleep to reload db t1: #{@task.processing_stage} t2: #{@task2.processing_stage}")
    end
    assert @task.processing_stage == PB::ChromePDFTask::STAGE_DONE, "task not done #{@task.processing_stage}"
    assert @task2.processing_stage == PB::ChromePDFTask::STAGE_DONE, "task not done #{@task2.processing_stage}"
    assert @task.has_error == false, "Task did not convert to PDF, #{@task.error_message}"
    assert @task2.has_error == false, "Task2 did not convert to PDF, #{@task2.error_message}"
    cmd_line = PB::CommandLine.get_merge_pdfs(book_pdf, [pdf1, pdf2])
    success = Kernel.system cmd_line
    assert success, "Failed to merge PDF files"
   end
  
end
