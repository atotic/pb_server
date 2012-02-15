#! bin/thin start -C config/pdf_saver_server.yml
# bin/rake test:all TEST=test/pdf_saver_server_test.rb


require 'config/settings'
require 'config/db'
require 'svegutils'
require 'rack'

DataMapper.finalize

# logging setup
LOGGER = PB.get_logger("comet")
if (SvegSettings.environment == :production) then
  stdoutFile = File.new(File.join(SvegSettings.log_dir, "comet.info"), "w")
  $stdout = stdoutFile
  $stderr = stdoutFile
end

$response = {
  :success => [  200, 
      { 'Content-Type' => 'text/plain', 'Content-Length' => '6',},
      ['comet!']],
  :no_work_available => [ 204, 
      { 'Content-Type' => 'text/plain', 'Content-Length' => '0'}, 
      [""]],
  :bad_request_no_id => [400, {}, ["Bad request. Need id in query params"]],
  :bad_request_task_stage => [405, {}, "Not allowed. Task not in STAGE_DISPATCHED_TO_CHROME" ],
  :bad_request_task_not_found => [404, {}, ["Task not found}"]]
}

class CometServer

  def self.log(env, msg="")
  	LOGGER.info env["REQUEST_METHOD"] + " " + env["SCRIPT_NAME"] + " " + msg
  end
  
  def self.handle_test(env)
    log(env)
    $response[:success]
  end
  
  def self.handle_listen
  end
  
end

# rackup looks for app in variable named Pdf_saver_server
Comet = Rack::Builder.new do
  map "/test" do
    run lambda { |env| CometServer.handle_test(env) }
  end
  map "/broadcast" do
    run lambda { |env| CometServer.handle_broadcast(msg_id, book_id, exclude_id) }
  end
  map "/listen" do
    run lambda { |env| CometServer.handle_listen(book_id, last_cmd_id)}
  end
  map "/status" do
    run lambda { |env| CometServer.handle_status}
  end
end.to_app

LOGGER.info "Comet started #{SvegSettings.environment.to_s} #{Time.now.to_s}"

$Comet = Comet
