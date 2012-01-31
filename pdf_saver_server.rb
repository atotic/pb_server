#thin start -C pdf_saver_server.yml
#require 'ruby-debug'

#https://github.com/rack/rack/wiki/(tutorial)-rackup-howto
require 'settings'
require 'logutils'
require 'app/book2pdf_job'
require 'ruby-debug'
require 'rack'

LOGGER = Log4r::Logger.new 'save_server'
LOGGER.add Log4r::FileOutputter.new("debug.log", :filename => File.join(SvegSettings.log_dir, 'pdf_saver_server_debug.log'))
LOGGER.add Log4r::Outputter.stdout
#LOGGER.add Log4r::GrowlOutputter.new('growlout')

# SERVER
$success_response = [  200, { 
      'Content-Type' => 'text/plain',
      'Content-Length' => '7',
    },  ['success']]

def handle_test(env)
  $success_response
end

def handle_work(env)
  # find a job, return 200 on success
  task = PB::ChromeHTMLToPDFTask.first(:processing_stage => PB::ChromeHTMLToPDFTask::STAGE_WAITING)
  return [ 204, { 'Content-Type' => 'text/plain',
                  'Content-Length' => 10
                }, ['no content']] unless task
  task.processing_stage = PB::ChromeHTMLToPDFTask::STAGE_DISPATCHED_TO_CHROME
  task.save
  [200, {'Content-Type' => 'application/json'}, task.to_json]
end

def handle_pdf_done(env)
  query = Rack::Utils.parse_query(env['QUERY_STRING'])
  return [400, {}, ["Bad request. Need id in query params"]] unless query['id']
  task = PB::ChromeHTMLToPDFTask.get(query['id'])
  unless task
    LOGGER.error("handle_pdf_done failed to find task " + query['id'])
    return [404, {}, ["Task #{query['id']} not found}"]]
  end
  unless (task.processing_stage == PB::ChromeHTMLToPDFTask::STAGE_DISPATCHED_TO_CHROME)
    LOGGER.error("handle_pdf_done received, but task is in wrong processing stage #{task.processing_stage}")
    return [405, {}, "Not allowed. Task not in STAGE_DISPATCHED_TO_CHROME" ]
  end
  File.open(task.pdf_file, "wb") do |f|
    f.write(env['rack.input'].read)
  end
  task.processing_stage = PB::ChromeHTMLToPDFTask::STAGE_DONE
  task.has_error = false
  task.save
  $success_response
end

def handle_pdf_fail(env)
  query = Rack::Utils.parse_query(env['QUERY_STRING'])
  return [400, {}, ["Bad request. Need id in query params"]] unless query['id']
  task = PB::ChromeHTMLToPDFTask.get(query['id'])
  unless task
    LOGGER.error("handle_pdf_fail failed to find task " + query['id'])
    return [404, {}, ["Task #{query['id']} not found}"]]
  end
  unless (task.processing_stage == PB::ChromeHTMLToPDFTask::STAGE_DISPATCHED_TO_CHROME)
    LOGGER.error("handle_pdf_fail received, but task is in wrong processing stage #{task.processing_stage}")
    return [405, {}, "Not allowed. Task not in STAGE_DISPATCHED_TO_CHROME" ]
  end
  task.has_error = true
  err =  env['rack.input'].read
  LOGGER.error("Task #{task.id} failed to generate pdf. #{err}")
  task.processing_stage = PB::ChromeHTMLToPDFTask::STAGE_DONE  
  task.error_message = err[0..127] # trunc for safety
  task.save
  $success_response
end

# rackup looks for app in variable named Pdf_saver_server
Pdf_saver_server = Rack::Builder.new do
  use Rack::CommonLogger, Logger.new(File.join(SvegSettings.log_dir, "pdf_saver_server.log"))
  map "/test" do
    run lambda { |env| handle_test(env) }
  end
  map "/get_pdf_work" do
    run lambda { |env| handle_work(env) }
  end
  map "/pdf_done" do
    run lambda { |env| handle_pdf_done(env) }
  end
  map "/pdf_fail" do
    run lambda { |env| handle_pdf_fail(env) }
  end
end.to_app
# declare global to make it visible to tests
$Pdf_saver_server = Pdf_saver_server
