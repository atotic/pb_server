#! bin/thin start --rackup pdf_saver_server.rb
# bin/rake test:server TEST=test/server/pdf_saver_server_test.rb

require 'rack'
require 'thin'
require 'json'

require_relative 'config/settings'
require_relative 'config/db'
require_relative 'config/delayed_job'
require_relative 'lib/sveg/utils'
require_relative 'lib/sveg/book2pdf_job'

PB.no_warnings { Thin::SERVER = "PDFSaver".freeze }

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
			:malformed_params => [400, {}, ["Malformed params"]],
			:bad_request_no_id => [400, {}, ["Bad request. Need id in query params"]],
			:bad_request_task_stage => [405, {}, "Not allowed. Task not in STAGE_DISPATCHED_TO_CHROME" ],
			:bad_request_task_not_found => [404, {}, ["Task not found}"]]
		}

		def self.do_not_wake_up_chrome
			@@last_poll = Time.now + 2 * 24 * 3600
		end

		def initialize
		end

		def logdot
			@poll_work_count = 0 unless @poll_work_count
			STDERR.write '.'
			if (++@poll_work_count > 80)
				STDERR.write "\n"
				@poll_work_count = 0
			end
		end

		def log(env, msg="")
			LOGGER.info env['REQUEST_METHOD'] + " " + env['PATH_INFO'] + " " + msg
		end

		def last_poll
			return @@last_poll
		end

		def handle_test(env)
			log(env)
			RESPONSE[:success]
		end

		def handle_get_work(env)
			logdot
			@@last_poll = Time.now
			query = Rack::Utils.parse_query(env['QUERY_STRING'])
			book_id = query['book_id']
			if (book_id)
				task = { :book_json => PB::Book[book_id], :task_id => "test" }
				return [200, {'Content-Type' => 'application/json'}, task.to_json]
			end
			# find a job, return 200 on success
			task = PB::ChromePDFTask.filter(:processing_stage => PB::ChromePDFTask::STAGE_WAITING).first
			dispatched_count = PB::ChromePDFTask.filter(:processing_stage => PB::ChromePDFTask::STAGE_DISPATCHED_TO_CHROME).count
			return RESPONSE[:no_work_available] unless task && dispatched_count < MAX_CONCURRENT_WORK
			log(env, "task " + task.id.to_s)
			task.processing_stage = PB::ChromePDFTask::STAGE_DISPATCHED_TO_CHROME
			task.save
			[200, {'Content-Type' => 'application/json'}, task.to_json]
		end

		def handle_work_complete(env)
			req = Rack::Request.new(env)
			return RESPONSE[:malformed_params] unless req.params['request_id']
			error = req.params['error']
			request_id = req.params['request_id']
			STDERR.write "/work_complete error #{request_id} #{error}" if req.params['error']
			if (request_id.eql? "test")
				debugger
				dest_dir = SvegSettings.tmp_dir;
				book = PB::Book[ req.params['book_id']]
				doc = JSON.parse book.document
				pdf_pages = []
				doc['pageList'].each do |f|
					pdf_pages.push File.join(dest_dir, "#{f}.pdf")
				end
				book_dest = File.join(dest_dir, "book#{book.id}.pdf")
				cmd_line = PB::CommandLine.get_merge_pdfs(book_dest, pdf_pages)
				STDERR.write cmd_line
				STDERR.write "\n"
				success = Kernel.system cmd_line
				debugger unless success
			else
				task = PB::ChromePDFTask[ request_id ]
				task.complete(req.params)
			end
			RESPONSE[:success]
		end

		def handle_pdf_upload(env)
			query = Rack::Utils.parse_query(env['QUERY_STRING'])
			return RESPONSE[:malformed_params] unless query['request_id']
			return RESPONSE[:malformed_params] unless query['page_id']
			startTime = Time.now
			dest_dir = SvegSettings.tmp_dir;
			if !(query['request_id'].eql? "test")
				task = PB::ChromePDFTask[query['request_id']]
				return [400, {}, ["Could not find task #{query['request_id']}"]] unless task
				dest_dir = task.book_dir
			end
			dest_file = File.join(dest_dir, "#{query['page_id']}.pdf");
			File.open(dest_file, "wb") do |f|
				f.write(env['rack.input'].read)
				f.flush
			end
			STDERR.write("handle_pdf_upload: #{dest_file} #{Time.now - startTime }\n");
			return RESPONSE[:success]
		end

		def call(env)
			response = case
				when env['PATH_INFO'].eql?("/get_work") then handle_get_work(env)
				when env['PATH_INFO'].eql?("/work_complete") then handle_work_complete(env)
				when env['PATH_INFO'].eql?("/pdf_upload") then handle_pdf_upload(env)
				when env['PATH_INFO'].eql?("/test") then handle_test(env)
				when env['PATH_INFO'].eql?('/die') then raise "die die"
				when env['PATH_INFO'].match(/favicon.ico/) then [200, {}, []]
				else [ 400, {'Content-Type' => 'text/plain'}, ["No such path #{env['PATH_INFO']}" ]]
			end
			response
		end

	end
end

# Monitor chromium.
# Restart if it has not contacted us in a while
Thread.new {
	chromium_timer = 5
	return
	while true do
		Kernel.sleep(chromium_timer)
		if Time.now > (PdfSaver.last_poll + chromium_timer) then
			PdfSaver::LOGGER.error("Chromium did not GET /get_work for more than #{chromium_timer} seconds. Restarting chromium")
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
#PdfSaver::LOGGER.info "tasks available: #{PB::ChromePDFTask.count}"

server_builder = Rack::Builder.new do
# not logging access, being polled by Chrome every second, continuosly
# access_log_file = ::File.new(File.join(SvegSettings.log_dir, "pdf_saver_access.#{PB.get_thin_server_port}.log" ), 'a')
# access_log_file.sync= true
# use Rack::CommonLogger, access_log_file
  use Rack::Session::Cookie, PB::SvegMiddleware::COOKIE_OPTIONS
  use PB::SvegMiddleware, { :ignore_sveg_http_headers => true, :logging => false }
  run PdfSaver::Server.new
end
Pdf_saver_server = server_builder.to_app

