# bin/rake test:all TEST=test/pdf_saver_server_test.rb
ENV['RACK_ENV'] = 'test'
#require 'ruby-debug'
#Debugger.settings[:autoeval] = true

require 'config/settings'
require 'test/unit'

require "rack/test"
require "pdf_saver_server"
require 'json'

# Exercises http API for pdf_saver_server.rb
class PDFSaverServerTest < Test::Unit::TestCase
  include Rack::Test::Methods

  def app
    return $Pdf_saver_server
  end
  
  def test_server_live
    get "/test"
    assert last_response.ok?
  end

  def make_task
    task = PB::ChromePDFTask.new({
      :book_pdf => "NOT A FILE.pdf",
      :html_file => "test.html",
    	:pdf_file => File.join(SvegSettings.data_dir,"pdf_saver_server_test.pdf"),
    	:book_id => 1,
    	:html_file_url => "file:///yo",
    	:pageWidth => 600,
    	:pageHeight => 600
    })
    assert task.valid?, "Task validation failed, #{task.errors.collect{|x| x.to_s}.to_s}"
    task.save
    task
  end

  def test_poll_pdf_work
    PB::ChromePDFTask.destroy
    get "/poll_pdf_work" # empty work queue
    # no work
    assert last_response.status == 204
    # create work
    task = make_task
    get "/poll_pdf_work" # one task in queue
    assert last_response.ok?
    json = JSON.parse(last_response.body)
    assert json['id'] = task.id
    task.reload
    assert task.processing_stage == PB::ChromePDFTask::STAGE_DISPATCHED_TO_CHROME
    get "/poll_pdf_work" # one task, but not availiable
    assert last_response.status == 204
    File.delete(task.pdf_file) if File.exist?(task.pdf_file)
    # test /pdf_done
    pdf_load = "mock pdf file"
    post("/pdf_done?id=#{task.id}", {}, {'rack.input' => StringIO.new(pdf_load) })
    assert last_response.ok?
    task.reload
    assert task.processing_stage == PB::ChromePDFTask::STAGE_DONE
    File.open(task.pdf_file, 'r') do |f|
      x = f.read
      assert pdf_load.eql? x
    end
    post("/pdf_done?id=#{task.id}", {}, {'rack.input' => StringIO.new(pdf_load) })
    assert  last_response.status == 405
    File.delete(task.pdf_file) if File.exist? task.pdf_file
    # test /pdf_fail
    task.processing_stage = PB::ChromePDFTask::STAGE_DISPATCHED_TO_CHROME
    task.save
    fail_str = "pdf could not be generated"
    post("/pdf_fail?id=#{task.id}", {}, { 'rack.input' => StringIO.new(fail_str) })
    task.reload
    assert task.processing_stage == PB::ChromePDFTask::STAGE_DONE
    assert task.error_message.eql? fail_str
    assert task.has_error == true
  end
  
  def test_poll_pdf_work_bad_requests
    post ("/pdf_done")
    assert last_response.status == 400, "id required"
    post ("/pdf_done?id=100000")
    assert last_response.status == 404, "no such task"
  end
end
