#! bin/thin start --rackup pdf_saver_server.rb
# bin/rake test:server TEST=test/server/pdf_saver_server_test.rb

require 'backports'
require 'rack'
require 'thin'
require 'json'

require_relative 'config/settings'
require_relative 'config/db'
require_relative 'config/delayed_job'
require_relative 'lib/sveg/utils'
require_relative 'lib/sveg/book2pdf_job'

Thin::SERVER = "PDFSaver".freeze

# logging setup
if (SvegSettings.environment == :production) then
	stdoutFile = File.new(File.join(SvegSettings.log_dir, "pdf_saver_server.info"), "w")
	$stdout = stdoutFile
	$stderr = stdoutFile
end

module PdfSaver

	LOGGER = PB.create_server_logger 'pdf_saver_server'

	class Server
		@@last_poll = Time.now
		MAX_CONCURRENT_WORK = 2
		RESPONSE = {
			:success => [ 200, 
					{ 'Content-Type' => 'text/plain', 'Content-Length' => '9',},
					['pdf_saver']],
			:no_work_available => [ 204, 
					{ 'Content-Type' => 'text/plain', 'Content-Length' => '0'}, 
					[""]],
			:bad_request_no_id => [400, {}, ["Bad request. Need id in query params"]],
			:bad_request_task_stage => [405, {}, "Not allowed. Task not in STAGE_DISPATCHED_TO_CHROME" ],
			:bad_request_task_not_found => [404, {}, ["Task not found}"]]
		}
	
		def self.do_not_wake_up_chrome
			@@last_poll = Time.now + 2 * 24 * 3600
		end

		def log(env, msg="")
			LOGGER.info env["REQUEST_METHOD"] + " " + env["SCRIPT_NAME"] + " " + msg
		end

		def last_poll 
			return @@last_poll
		end
	
		def handle_test(env)
			log(env)
			RESPONSE[:success]
		end

		def handle_poll_work(env)
			@@last_poll = Time.now
			# find a job, return 200 on success
			task = PB::ChromePDFTask.filter(:processing_stage => PB::ChromePDFTask::STAGE_WAITING).first
			dispatched_count = 
				PB::ChromePDFTask.filter(:processing_stage => PB::ChromePDFTask::STAGE_DISPATCHED_TO_CHROME).count
			return RESPONSE[:no_work_available] unless task && dispatched_count < MAX_CONCURRENT_WORK
			log(env, "task " + task.id.to_s)
			task.processing_stage = PB::ChromePDFTask::STAGE_DISPATCHED_TO_CHROME
			task.save
			[200, {'Content-Type' => 'application/json'}, task.to_json]
		end

		def handle_pdf_done(env)
			query = Rack::Utils.parse_query(env['QUERY_STRING'])
			return RESPONSE[:bad_request_no_id] unless query['id']
			task = PB::ChromePDFTask[query['id']]
			unless task
				LOGGER.error("handle_pdf_done failed to find task " + query['id'])
				return RESPONSE[:bad_request_task_not_found]
			end
			unless (task.processing_stage == PB::ChromePDFTask::STAGE_DISPATCHED_TO_CHROME)
				LOGGER.error("handle_pdf_done received, task in wrong processing stage #{task.processing_stage}")
				return RESPONSE[:bad_request_task_stage]
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
			log(env, "task " + task.id.to_s)
			RESPONSE[:success]
		end

		def handle_pdf_fail(env)
			query = Rack::Utils.parse_query(env['QUERY_STRING'])
			return RESPONSE[:bad_request_no_id] unless query['id']
			task = PB::ChromePDFTask[query['id']]
			unless task
				LOGGER.error("handle_pdf_fail failed to find task " + query['id'])
				return RESPONSE[:bad_request_task_stage]
			end
			unless (task.processing_stage == PB::ChromePDFTask::STAGE_DISPATCHED_TO_CHROME)
				LOGGER.error("handle_pdf_fail received, but task is in wrong processing stage #{task.processing_stage}")
				return RESPONSE[:bad_request_task_stage]
			end
			task.has_error = true
			err = env['rack.input'].read
			LOGGER.error("Task #{task.id} failed to generate pdf. #{err}")
			task.processing_stage = PB::ChromePDFTask::STAGE_DONE
			task.error_message = err[0..127] # trunc for safety
			task.save
			Delayed::Job.enqueue PB::BookToPdfCompleteJob.new(task.book_id)
			log(env, "task " + task.id.to_s)
			RESPONSE[:success]
		end

		def call(env)
			log env
			response = case
				when env['PATH_INFO'].eql?("/poll_pdf_work") then handle_poll_work(env)
				when env['PATH_INFO'].eql?("/pdf_done") then handle_pdf_done(env)
				when env['PATH_INFO'].eql?("/pdf_fail") then handle_pdf_fail(env)
				when env['PATH_INFO'].eql?("/test") then handle_test(env)
				else [ 400, {'Content-Type' => 'text/plain'}, ["No such path #{env['PATH_INFO']}" ]] 
			end
			LOGGER.info("Reply #{response[0]}")
			response
		end

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
			orphans = PB::ChromePDFTask.filter(:processing_stage => PB::ChromePDFTask::STAGE_DISPATCHED_TO_CHROME)
			orphans.each do |t|
				PdfSaver::LOGGER.warn("Task #{t.id} was orphaned. Resetting.")
				o.processing_stage = PB::ChromePDFTask::STAGE_WAITING;
				o.save
			end
			PdfSaver::LOGGER.info(`#{File.join(SvegSettings.root_dir, 'script/chrome')} restart`)
		end
	end
}

PdfSaver::LOGGER.info "started #{SvegSettings.environment.to_s} #{Time.now.to_s}"
PdfSaver::LOGGER.info "tasks available: #{PB::ChromePDFTask.count}"

Pdf_saver_server = PdfSaver::Server.new
