#! bin/thin start --rackup pdf_saver_server.rb
# bin/rake test:all TEST=test/pdf_saver_server_test.rb


require 'config/settings'
require 'config/db'
require 'svegutils'
require 'app/book2pdf_job'
require 'rack'
require 'config/delayed_job'

DataMapper.logger.set_log(StringIO.new, :fatal) # /dev/null logger, we access db continuously
DataMapper.finalize

# logging setup
if (SvegSettings.environment == :production) then
  stdoutFile = File.new(File.join(SvegSettings.log_dir, "pdf_saver_server.info"), "w")
  $stdout = stdoutFile
  $stderr = stdoutFile
end

$response = {
  :success => [  200, 
      { 'Content-Type' => 'text/plain', 'Content-Length' => '9',},
      ['pdf_saver']],
  :no_work_available => [ 204, 
      { 'Content-Type' => 'text/plain', 'Content-Length' => '0'}, 
      [""]],
  :bad_request_no_id => [400, {}, ["Bad request. Need id in query params"]],
  :bad_request_task_stage => [405, {}, "Not allowed. Task not in STAGE_DISPATCHED_TO_CHROME" ],
  :bad_request_task_not_found => [404, {}, ["Task not found}"]]
}

module PdfSaver

  @@last_poll = Time.now
  MAX_CONCURRENT_WORK = 2
  LOGGER = PB.get_logger 'pdf_saver_server'
  
  def self.log(env, msg="")
  	LOGGER.info env["REQUEST_METHOD"] + " " + env["SCRIPT_NAME"] + " " + msg
  end

  def self.last_poll 
    return @@last_poll
  end
  
  def self.do_not_wake_up_chrome
    @@last_poll = Time.now + 2 * 24 * 3600
  end
  
  def self.handle_test(env)
    log(env)
    $response[:success]
  end

  def self.handle_poll_work(env)
    @@last_poll = Time.now
    # find a job, return 200 on success
    task = PB::ChromePDFTask.first(:processing_stage => PB::ChromePDFTask::STAGE_WAITING)
    dispatched_count = 
      PB::ChromePDFTask.count(:processing_stage => PB::ChromePDFTask::STAGE_DISPATCHED_TO_CHROME)
    return $response[:no_work_available] unless task && dispatched_count < MAX_CONCURRENT_WORK
    self.log(env, "task " + task.id.to_s)
    task.processing_stage = PB::ChromePDFTask::STAGE_DISPATCHED_TO_CHROME
    task.save
    [200, {'Content-Type' => 'application/json'}, task.to_json]
  end

  # If save fails, retry after a couple of seconds
  def self.saveTask(task)
    done = false
    begin
      task.save
    rescue => ex
      Kernel.sleep(2)
      LOGGER.warn("Database busy, retrying to save task #{task[:id]}")
      task.save
    end
  end

  def self.handle_pdf_done(env)
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
    begin
      File.open(task.pdf_file, "wb") do |f|
        f.write(env['rack.input'].read)
        f.flush
      end
      task.processing_stage = PB::ChromePDFTask::STAGE_DONE
      task.has_error = false
      task.save # can fail with locked database for sqlite
      Delayed::Job.enqueue PB::BookToPdfCompleteJob.new(task.book_id)
    rescue => ex
      Kernel.sleep(1)
      task.processing_stage = PB::ChromePDFTask::STAGE_DONE
      task.has_error = true
      task.error_message = ex.message[0..127]
      task.save
      Delayed::Job.enqueue PB::BookToPdfCompleteJob.new(task.book_id)
    end    
    self.log(env, "task " + task.id.to_s)
    $response[:success]
  end

  def self.handle_pdf_fail(env)
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
    Delayed::Job.enqueue PB::BookToPdfCompleteJob.new(task.book_id)
    self.log(env, "task " + task.id.to_s)
    $response[:success]
  end
end

# Monitor chromium. 
# Restart if it has not contacted us in a while
Thread.new {
  chromium_timer = 5
  while true do
    Kernel.sleep(chromium_timer)
    if Time.now > (PdfSaver.last_poll + chromium_timer) then
      PdfSaver::LOGGER.error("Chromium did not GET /poll_pdf_work for more than #{chromium_timer} seconds. Restarting chromium")
      orphans = PB::ChromePDFTask.all(:processing_stage => PB::ChromePDFTask::STAGE_DISPATCHED_TO_CHROME)
      orphans.each do |t|
        PdfSaver::LOGGER.warn("Task #{t.id} was orphaned. Resetting.")
        o.processing_stage = PB::ChromePDFTask::STAGE_WAITING;
        o.save
      end
      PdfSaver::LOGGER.info(`#{File.join(SvegSettings.root_dir, 'script/chrome')} restart`)
    end
  end
}

# rackup looks for app in variable named Pdf_saver_server
Pdf_saver_server = Rack::Builder.new do
  map "/test" do
    run lambda { |env| PdfSaver.handle_test(env) }
  end
  map "/poll_pdf_work" do
    run lambda { |env| PdfSaver.handle_poll_work(env) }
  end
  map "/pdf_done" do
    run lambda { |env| PdfSaver.handle_pdf_done(env) }
  end
  map "/pdf_fail" do
    run lambda { |env| PdfSaver.handle_pdf_fail(env) }
  end
end.to_app

PdfSaver::LOGGER.info "started #{SvegSettings.environment.to_s} #{Time.now.to_s}"
PdfSaver::LOGGER.info "tasks available: #{PB::ChromePDFTask.count}"

$Pdf_saver_server = Pdf_saver_server
