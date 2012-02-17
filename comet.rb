#! bin/thin start -C config/pdf_saver_server.yml
# bin/rake test:all TEST=test/pdf_saver_server_test.rb

# Comet is an http server handling command streaming
# 
require 'config/settings'
require 'config/db'
require 'svegutils'
require 'rack'
require 'eventmachine'

DataMapper.finalize

module Comet

LOGGER = PB.get_logger("comet")

class DeferrableBody
  include ::EventMachine::Deferrable

  def call(body)
    body.each { |chunk| @body_callback.call(chunk) }
  end

  def each(&blk)
    @body_callback = blk
  end

  def <<(str)
  	@body_callback.call(str)
  	self
  end
end

# Broadcasts command to all open streams
# based on https://github.com/rkh/presentations/blob/realtime-rack/example.rb
# and http://code.google.com/p/jquery-stream/wiki/ServerSideProcessing
class CmdStreamBroadcaster
	@@listeners = Hash.new # { :book_id => [ [body, stream_id]* ]  }
	
	def self.bind(body, book_id, last_cmd_id)	# subscriber is DeferrableBody
		book_id = Integer(book_id)
		stream_id = rand(36**6).to_s(36).upcase
		@@listeners[book_id] = [] unless @@listeners.has_key? book_id
		@@listeners[book_id].push [ body, stream_id ]
		LOGGER.info("CmdStreamBroadcaster.bind " + stream_id)
		
		# send standard js streaming header
		body << stream_id << ";" << " " * 1024 << ";" 
		# send all the outstanding commands 
		commands = ServerCommand.all(:id.gt => last_cmd_id, :book_id => book_id)
		commands.each { |cmd| body << self.encode_msg(cmd) }
		# tell client they are up to date
		self.send_stream_up_to_date(book_id, body);
	end
	
	def self.unbind(book_id, body)
		book_id = Integer(book_id)
		stream_id = "";
		book_listens = @@listeners[book_id]
		book_listens.delete_if do |item| 
			stream_id = item[1] if item[0] == body 
			item[0] == body
		end
		LOGGER.info("CmdStreamBroadcaster.unbind " + stream_id)
	end

	# broadcast msg to (everyone except exclude_id) listening on book_id
	# msg is String||ServerCommand
	def self.broadcast( msg, book_id, exclude_id )
		LOGGER.info("CmdStreamBroadcaster.send")
		book_id = Integer(book_id)
		encoded_msg = self.encode_msg(msg)
		streams = @@listeners[Integer(book_id)] || []
		streams.each do |item| 
#			LOGGER.info("Sending to #{item[1]} " + encoded_msg[1..10]) unless item[1].eql?(exclude_id)
			item[0] << encoded_msg unless item[1].eql?(exclude_id) 
		end
	end

private
	def self.encode_msg(msg)
		msg = self.encode_command(msg) if msg.kind_of? PB::ServerCommand
		(StringIO.new << msg.length << ";" << msg << ";") .string
	end
	
	def self.encode_command(cmd)
		{
			:id => cmd.id,
			:type => cmd.type,
			:book_id => cmd.book_id,
			:payload => JSON.parse(cmd.payload)
		}.to_json		
	end
	
	def self.send_stream_up_to_date(book_id, body) 
			s = {
				:type => "StreamUpToDate",
				:book_id => book_id
			}.to_json
			body << self.encode_msg(s)
	end
	
end


class Server

  RESPONSE = {
    :success => [  200, 
        { 'Content-Type' => 'text/plain', 'Content-Length' => '6',},
        ['comet!']],
    :bad_request_no_id => [400, {}, ["Bad request. Need id in query params"]],
    :bad_request_task_stage => [405, {}, "Not allowed. Task not in STAGE_DISPATCHED_TO_CHROME" ],
    :bad_request_task_not_found => [404, {}, ["Task not found}"]]
  }


  def self.log(env, msg="")
  	LOGGER.info env["REQUEST_METHOD"] + " " + env["SCRIPT_NAME"] + " " + msg
  end

  def self.handle_test(env)
    log(env)
    RESPONSE[:success]
  end

  # /subscribe/:book_id, 
  def self.handle_subscribe(env)
    book_id = params[:book_id];
		last_cmd_id = params['last_cmd_id']
		body = DeferrableBody.new
		# send out headers right away
		EM.next_tick { env['async.callback'].call [200, {'Content-Type' => 'text/plain'}, body] }
		# bind to command broadcaster
		EM.next_tick { CmdStreamBroadcaster.bind(body, book_id, last_cmd_id) }
		# unbind on close
		env['async.close'].callback { CmdStreamBroadcaster.unbind(book_id, body) }
		# returning AsyncResponse dies in sinatra/base.rb:874 (can't modify frozen array)
		throw :async
  end

end
end
# rackup looks for app in variable named Pdf_saver_server
CometApp = Rack::Builder.new do
  map "/test" do
    run lambda { |env| Comet::Server.handle_test(env) }
  end
  map "/subscribe" do
    run lambda { |env| Comet::Server.handle_subscribe(env)}
  end
  map "/broadcast" do
    run lambda { |env| Comet::Server.handle_broadcast(msg_id, book_id, exclude_id) }
  end
  map "/status" do
    run lambda { |env| Comet::Server.handle_status}
  end
end.to_app

Comet::LOGGER.info "Comet started #{SvegSettings.environment.to_s} #{Time.now.to_s}"

$Comet = CometApp
