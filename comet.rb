# bin/rake test:server TEST=test/server/comet_test.rb

# Comet is an http server handling command streaming
# 
require 'config/settings'
require 'config/db'
require 'svegutils'
require 'rack'
require 'eventmachine'
require 'thin'
require 'app/command_stream'

DataMapper.finalize
Thin::Logging.silent = false;

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
    puts "body << #{str}"
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
		commands = ::PB::ServerCommand.all(:id.gt => last_cmd_id, :book_id => book_id)
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
    :need_async_server => [500, {}, ["Internal server error. Not running inside async server"]]
  }

  def log(env, msg="")
  	LOGGER.info env["REQUEST_METHOD"] + " " + env["SCRIPT_NAME"] + " " + msg
  end

  def handle_test(env)
    log(env)
    RESPONSE[:success]
  end

  # /subscribe/:book_id, 
  def handle_subscribe(env, book_id)
    # TODO AUTHENTICATE
    return RESPONSE[:need_async_server] unless env['async.close']
    query = Rack::Utils.parse_query(env['QUERY_STRING'])
    last_cmd_id = (query.has_key? 'last_cmd_id') ? query['last_cmd_id'].to_i : 0    
	body = DeferrableBody.new
	EM.next_tick do
  		# send out headers right away
		env['async.callback'].call [200, {'Content-Type' => 'text/plain', 'Transfer-Encoding' => 'chunked'}, body]
  		# bind to command broadcaster
		CmdStreamBroadcaster.bind(body, book_id, last_cmd_id)
	end
	# unbind on close
    env['async.close'].callback { CmdStreamBroadcaster.unbind(book_id, body) }
	# returning AsyncResponse dies in sinatra/base.rb:874 (can't modify frozen array)
	return Thin::Connection::AsyncResponse
  end
  
  def handle_broadcast(env, msg_id)
    query = Rack::Utils.parse_query(env['QUERY_STRING'])
    msg = ::PB::ServerCommand.get(msg_id)
    return  [500, {}, ["Message not found #{msg_id}"]] unless msg
    query = Rack::Utils.parse_query(env['QUERY_STRING'])
    exclude_id = (query.has_key? 'exclude') ? query['exclude'] : nil    
    book_id = (query.has_key? 'book_id') ? query['book_id'] : mgs.book_id
    CmdStreamBroadcaster.broadcast(msg, book_id, exclude_id)
  end
  
  def call(env)
    case
    when env['PATH_INFO'] =~ /^\/subscribe\/book\/[\d+]$/ then handle_subscribe(env, $~[1].to_i)
    when env['PATH_INFO'] =~ /^\/test/ then handle_test(env)
    # /broadcast/:msg_id?[exclude=stream_id]
    when env['PATH_INFO'] =~ /^\/broadcast\/[\d+]$/ then handle_broadcast(env, )
    when env['PATH_INFO'] =~ /^\/status/ then handle_status(env)
    else [ 400, {'Content-Type' => 'text/plain'}, ["No such path #{env['PATH_INFO']}" ]] 
    end
  end

end

end # module

CometApp = Comet::Server.new

Comet::LOGGER.info "Comet started #{SvegSettings.environment.to_s} #{Time.now.to_s}"

$Comet = CometApp
