#! bin/thin start -C config/pdf_saver_server.yml
# bin/rake test:all TEST=test/pdf_saver_server_test.rb

require 'config/settings'
require 'config/db'
require 'svegutils'
require 'app/book2pdf_job'
require 'rack'

DataMapper.finalize

# logging setup
LOGGER = Log4r::Logger.new 'pdf_saver_server'
LOGGER.add Log4r::FileOutputter.new("pdf_saver_server.info", :filename => File.join(SvegSettings.log_dir, 'pdf_saver_server.info'))
# LOGGER.add Log4r::Outputter.stdout if SvegSettings.environment == :development


if (SvegSettings.environment == :production) then
  stdoutFile = File.new(File.join(SvegSettings.log_dir, "pdf_saver_server.stdout"), "w")
  $stdout = stdoutFile
  $stderr = stdoutFile
end

$response = {
  :success => [  200, 
      { 'Content-Type' => 'text/plain', 'Content-Length' => '7',},
      ['success']],
  :no_work_available => [ 204, 
      { 'Content-Type' => 'text/plain', 'Content-Length' => '0'}, 
      [""]],
  :bad_request_no_id => [400, {}, ["Bad request. Need id in query params"]],
  :bad_request_task_stage => [405, {}, "Not allowed. Task not in STAGE_DISPATCHED_TO_CHROME" ],
  :bad_request_task_not_found => [404, {}, ["Task not found}"]]
}

def handle_test(env)
  $response[:success]
end


MAX_CONCURRENT_WORK = 1
def handle_poll_work(env)
  # find a job, return 200 on success
  task = PB::ChromePDFTask.first(:processing_stage => PB::ChromePDFTask::STAGE_WAITING)

#  PB::ChromePDFTask.all.each do |t|
#    LOGGER.info "Task #{t.id} #{t.processing_stage}"
#  end if task.nil?
#total_count = PB::ChromePDFTask.count
#waiting = PB::ChromePDFTask.count(:processing_stage => PB::ChromePDFTask::STAGE_WAITING)  
# LOGGER.info "tasks total: #{total_count}, waiting: #{waiting}"

  dispatched_count = PB::ChromePDFTask.count(:processing_stage => PB::ChromePDFTask::STAGE_DISPATCHED_TO_CHROME)
  return $response[:no_work_available] unless task && dispatched_count < MAX_CONCURRENT_WORK
   
  task.processing_stage = PB::ChromePDFTask::STAGE_DISPATCHED_TO_CHROME
  task.save
  [200, {'Content-Type' => 'application/json'}, task.to_json]
end

def handle_pdf_done(env)
  query = Rack::Utils.parse_query(env['QUERY_STRING'])
  return $response[:bad_request_no_id] unless query['id']
  task = PB::ChromePDFTask.get(query['id'])
  unless task
    LOGGER.error("handle_pdf_done failed to find task " + query['id'])
    return $response[:bad_request_task_not_found]
  end
  unless (task.processing_stage == PB::ChromePDFTask::STAGE_DISPATCHED_TO_CHROME)
    LOGGER.error("handle_pdf_done received, task in wrong processing stage #{task.processing_stage}")
    return $response[:bad_request_task_stage]
  end
  File.open(task.pdf_file, "wb") do |f|
    f.write(env['rack.input'].read)
    f.flush
  end
  task.processing_stage = PB::ChromePDFTask::STAGE_DONE
  task.has_error = false
  task.save
  $response[:success]
end

def handle_pdf_fail(env)
  query = Rack::Utils.parse_query(env['QUERY_STRING'])
  return $response[:bad_request_no_id] unless query['id']
  task = PB::ChromePDFTask.get(query['id'])
  unless task
    LOGGER.error("handle_pdf_fail failed to find task " + query['id'])
    return $response[:bad_request_task_stage]
  end
  unless (task.processing_stage == PB::ChromePDFTask::STAGE_DISPATCHED_TO_CHROME)
    LOGGER.error("handle_pdf_fail received, but task is in wrong processing stage #{task.processing_stage}")
    return $response[:bad_request_task_stage]
  end
  task.has_error = true
  err =  env['rack.input'].read
  LOGGER.error("Task #{task.id} failed to generate pdf. #{err}")
  task.processing_stage = PB::ChromePDFTask::STAGE_DONE  
  task.error_message = err[0..127] # trunc for safety
  task.save
  $response[:success]
end

# rackup looks for app in variable named Pdf_saver_server
Pdf_saver_server = Rack::Builder.new do
  use Rack::CommonLogger, Logger.new(File.join(SvegSettings.log_dir, "pdf_saver_server.log"))
  map "/test" do
    run lambda { |env| handle_test(env) }
  end
  map "/poll_pdf_work" do
    run lambda { |env| handle_poll_work(env) }
  end
  map "/pdf_done" do
    run lambda { |env| handle_pdf_done(env) }
  end
  map "/pdf_fail" do
    run lambda { |env| handle_pdf_fail(env) }
  end
end.to_app

LOGGER.info "pdf_saver_server started #{SvegSettings.environment.to_s} #{Time.now.to_s}"
tasks_available = PB::ChromePDFTask.count
LOGGER.info "tasks available: #{PB::ChromePDFTask.count}"

# declare global to make it visible to tests
$Pdf_saver_server = Pdf_saver_server
# def make_task
#   pdf_file = File.join(SvegSettings.data_dir,"chrome_saver_test_page1.pdf")
#   html_file =  File.join(SvegSettings.test_dir, "public", "page1.html" )
#   task = PB::ChromePDFTask.new({
#     :html_file => html_file,
#     :pdf_file => pdf_file,
#     :book_id => 1,
#     :html_file_url => "file://" + html_file,
#     :pageWidth => 600,
#     :pageHeight => 600
#   })
#   task.save
#   task
# end
# 
# DataMapper.auto_migrate!
# make_task
# make_task
# make_task
# make_task
# make_task
# make_task
# make_task