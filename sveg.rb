require 'settings'
#Debugger.settings[:autoeval] = true
#Debugger.settings[:autolist] = true

require 'sinatra/base'
require 'erb'
require 'json'
require 'base64'
require 'rack-flash'
require 'logutils'

# sveg requires
require 'app/book2pdf_job'

# Quick and dirty shutdown
# EventMachine takes about 10s to close my local streaming connection, too long for dev cycle
module Sinatra
	class Base
		class << self
			alias old_quit! quit!
			def quit!(server, handler_name)
				old_quit!(server, handler_name)
				Kernel.abort("Sveg's quick exit")
			end
		end
	end
end

module PB


LOGGER = Log4r::Logger.new 'svegapp'
Log4r::Outputter.stdout.formatter= Log4r::PatternFormatter.new(:pattern => '%l %m')
LOGGER.add Log4r::Outputter.stdout
LOGGER.add Log4r::FileOutputter.new("debug.log", :filename => File.join(SvegSettings.log_dir, 'debug.log'))
LOGGER.add Log4r::GrowlOutputter.new('growlout')

class SvegLogger
	FORMAT = %{ %s"%s %s%s %s" %s %0.4f}
	def initialize(app)
		@app = app
		@logger = Log4r::Logger['svegapp']
	end

	def call(env)
		start_time = Time.now
		status, header, body = @app.call(env)
		log(env, status, Time.now - start_time)
		[status, header, body]
	end

	def log(env, status, time_taken)
		now = Time.now
		return if env['sinatra.static_file']
		return if /assets/ =~ env["PATH_INFO"] 
		@logger.error "HTTP ERROR" if status >= 400
		@logger.info FORMAT % [
			env["REMOTE_USER"] || "-",
			env["REQUEST_METHOD"],
			env["PATH_INFO"],
			env["QUERY_STRING"].empty? ? "" : "?"+env["QUERY_STRING"],
			env["HTTP_VERSION"],
			status.to_s[0..3],
			time_taken ]
	end
end


# Our sessions
# Rolled my own to prevent cookie traffic on every response
# SessionMiddleware saves/restores Session objects
# Session object maintains 2 cookies:
#  - flash cookie holds flash messages
#  - user cookie holds user information

class Session

	attr_accessor :user_id
	
	def self.from_cookie(user_cookie, flash_cookie)
		return self.new(user_cookie, flash_cookie)
	end
	
	def initialize(user_cookie, flash_cookie)
		clear_user
		if user_cookie
			begin 
				hash = Marshal.load(Base64.decode64(user_cookie))
				@user_id = hash[:id]
			rescue
				LOGGER.error("Error decoding cookie #{user_cookie}")
			end
		end
		if flash_cookie
			begin
				@flash = JSON.parse flash_cookie
				@flash.keys.each do |key|		# JSON encoded symbols as strings :(
					if (key.class == String)
						@flash[key.intern] = @flash[key]
						@flash.delete(key)
 					end
				end
			rescue
				LOGGER.error "Could not parse flash cookie #{flash_cookie}"
				@flash = {}
			end
		else
			@flash = {}
		end
	end

	def clear_user
		@save_on_server = false
		@expires = Time.now + 60 * 60 * 24	# TODO fix login expiration
		@user_id = nil			
	end
	
	def save_on_server?
		@save_on_server
	end	
	
	def save_on_server!
		@save_on_server = true
	end
	
	def to_cookie_hash
		{
			:path => '/',
			:httponly => true,
			:expires => @expires,
			:value => Base64.encode64(Marshal.dump(
				{:id => @user_id}
			))
		}
	end
	# access
	
	def user
		User.get(@user_id)
	end
	
	def resource(*args)
		
	end

	# flash methods
	
	def to_flash_hash
		retVal = {
			:path => '/',
			:httponly => true,
			:value => JSON.generate(@flash)
		}
		retVal[:expires] =  Time.now - 3600 if @flash.empty?	# delete cookie if empty
		retVal
	end
	
	def save_flash?
		return !@flash.empty?
	end

	def [](prop)
		raise "Unknown property #{prop}" unless prop == :__FLASH__
		@flash
	end
	
	def []=(prop, val)
		raise "Unknown property #{prop}" unless prop == :__FLASH__
		@flash = val
	end
end

# Home grown session middleware
# have 2 cookies, one for login, one for flash
class SessionMiddleware
	@@key = "sveg.session"
	@@flash_key = "flash.session"
	
	def initialize(app, options={})
		@app = app;
	end

	def call(env)
		request = Rack::Request.new(env)
		load_session(env, request)
		status, headers, body = @app.call(env)
		save_session(env, headers, request) if status != -1
		[status, headers, body]
	end
	
	def load_session(env, request)
		env["rack.session"] = Session.from_cookie(
			request.cookies[@@key],
			request.cookies[@@flash_key])
	end
	
	def save_session(env, headers, request)
		if env["rack.session"].save_on_server?
			Rack::Utils.set_cookie_header!(headers, @@key, env["rack.session"].to_cookie_hash) 
		end
		if env['rack.session'].save_flash? || request.cookies[@@flash_key]
			Rack::Utils.set_cookie_header!(headers, @@flash_key, env['rack.session'].to_flash_hash)
		end
	end
end


#
# Main application
#
class SvegApp < Sinatra::Base

	set :root, File.dirname(__FILE__)
	set :show_exceptions, true
	
#	set :static_cache_control, "max-age=3600" # serve stuff from public with expiry date
	def initialize(*args)
		super(args)
	end
		
	helpers do
		include Rack::Utils
		
		alias_method :h, :escape_html
		
		def show_error(object, prop)
			"<span class=\"error_message\">#{object.errors[prop]}</span>" if (object && object.errors[prop])
		end
		
		def print_datetime(dt)
			dt.strftime "%b %d %I:%M%p"
		end
		
		# TODO really redirect back, should use cookies?
		def redirect_back
			redirect "/"
#			redirect "/" if !request.referer || request.referer.end_with?(request.path_info)
#			redirect request.referer
		end

		# args are a list of resources 
		# ex: asset_link("jquery.js", "jquery-ui.js", "application.css")
		def asset_link(*args)
			retVal = "";		
			args.each do |arg|
				arg = arg.to_s if arg.is_a?(Symbol)
				if arg.end_with?("js")
					arg = "jquery-1.7.js" if arg.eql? "jquery.js"
					arg = "jquery-ui-1.8.16.custom.js" if arg.eql? "jquery-ui.js"
					retVal += "<script src='/javascripts/#{arg}'></script>\n"				
				elsif arg.end_with?("css")
					arg = "smoothness/jquery-ui-1.8.16.custom.css" if arg.eql? "jquery-ui.css"
					retVal += "<link href='/stylesheets/#{arg}' rel='stylesheet' type='text/css' />\n"
				elsif arg.eql? "qunit"
					retVal += "<script src='http://code.jquery.com/qunit/qunit-git.js'></script>\n"
					retVal += "<link href='http://code.jquery.com/qunit/qunit-git.css' rel='stylesheet' type='text/css' />\n"
				elsif arg.eql? "editor-base"
					retVal += asset_link("editor.js", "editor.model.js", "editor.model.page.js", "editor.model.util.js", "editor.command.js", \
					"jquery.stream-1.2.js", "editor.streaming.js");
				elsif arg.eql? "editor-all"
					retVal += asset_link("editor-base", "editor.manipulators.js",\
					 "editor.ui.js", "editor.ui.phototab.js","editor.ui.pagetab.js",\
					 "editor.ui.bookpage.js", "editor.page-dialog.js");
				else
					raise "Unknown asset #{arg}"
				end
			end
			retVal
		end
		
		# User access
		def current_user
			env['rack.session'].user
		end

		def user_must_be_logged_in
			return if env['rack.session'].user
			if (request.xhr?)
				flash.now[:error] = "You must be logged in to access #{env['REQUEST_PATH']}."
				halt 401
			else
				flash[:error] = "You must be logged in to access #{env['REQUEST_PATH']}."
				redirect_back
			end
		end

		def user_must_be_admin
			return if current_user && current_user.is_administrator
			flash[:notice] = "You must be an administrator to access that page."
			redirect_back
		end
		
		def user_must_own(resource)
			user_must_be_logged_in
			unless resource
				flash[:error] = "Resource not found."
				if (request.xhr?)
					halt 404
				else
					redirect_back
				end
			end
			if !current_user || (current_user.id != resource.user_id && !current_user.is_administrator)
				flash[:error]="Access not allowed."
				if request.xhr?
					halt 401
				else
					redirect_back
				end
			end
		end

		def get_stream(request)
			stream_header = request.env['HTTP_X_SVEGSTREAM']
			stream_id, book_id = stream_header.split(";") if stream_header
			stream_id
		end
		
		def get_last_command_info(request)
			stream_id = book_id = last_command_id = nil
			stream_header = request.env['HTTP_X_SVEGSTREAM']
			last_command_id = request.env['HTTP_X_SVEG_LASTCOMMANDID']
#			LOGGER.info("request " + request.env.object_id.to_s + " " + last_command_id.to_s)
			debugger if (last_command_id.nil? || last_command_id == "undefined")
			last_command_id = Integer(last_command_id) if last_command_id
			if stream_header
				stream_id, book_id = stream_header.split(";")
				book_id = Integer(book_id) if book_id
			end
			[stream_id, book_id, last_command_id]
		end
		
		def assert_last_command_up_to_date(request)
			stream_id, book_id, last_command_id = get_last_command_info(request)
			halt 412, {'Content-Type' => 'text/plain'}, "You must supply last command" if last_command_id.nil?
			halt 412, {'Content-Type' => 'text/plain'}, "Your last command is not up to date" if last_command_id != ServerCommand.last_command_id(book_id)
		end
	end # helpers

	after do
		if request.xhr? # ajax requests get flash headers
			headers({"X-FlashError" => flash[:error]}) if flash[:error]
			headers({"X-FlashNotice" => flash[:notice]}) if flash[:notice]
		end
	end

	#
	# CONTROLLER METHODS
	#


	# development-only methods	
	if settings.environment == :development
		get '/debugger' do
			debugger
		end
		
		get '/routes' do
			r = []
			settings.routes.keys.each do |key|
				next if key.eql? "HEAD"
				settings.routes[key].each do |route|
					path, vars = route
					path = path.to_s.sub("(?-mix:^\\", "").sub("$)", "").sub("\\", "")
					vars.each { |var| path = path.sub("([^\\/?#]+)", ":" + var) }
					path = path.gsub("\\", "")
					x = { :path => path, 
						:key => key,
						:vars => vars}
					r.push x
				end
			end
			r.sort! { |x, y| 
				x[:path] == y[:path] ? x[:key] <=> y[:key] : x[:path] <=> y[:path]
			}
			content_type "text/plain"
			response['Content-Disposition'] = "inline; filename=ROUTES.txt"
			body = ""
			r.each { |x| body += x[:key] + " " + x[:path] + " " + "\n"}
#			r.each { |x| body += x[:key] + " " + x[:path] + " " +  x[:vars].join(" ") + "\n"}
			body
		end
		
		get '/test/:id' do
			erb :"test/#{params[:id]}"	
		end
		
#		get 'test/qunit' do
#			Dir[glob].sort.each do |node|
#        stat = stat(node)
#        next unless stat
#			end
#			run Rack::Directory.new("#{Dir.pwd}/views/test/qunit");
#		end
		
		get '/test/qunit/:id' do
			@filename = params[:id]
			erb :"test/qunit/#{params[:id]}", {:layout => :'test/qunit/layout'}, {:locals => { :filename => params[:id] }}
		end
	
	  get '/jobs' do
	    jobs = Delayed::Backend::DataMapper::Job.all
	    content_type "text/html"
      body = "<html><head><title>jobs</title></head><body>"
#	    body = "<html><head><title>jobs</title><meta http-equiv='Refresh' content='5' /></head><body>"
	    body += "<p>Jobs table</p><table border='1'><thead><td>Id</td><td>Time</td><td>Handler</td><td>Failed</td><td>Error</td>"
	    if jobs.nil?
	      body += "<tr><td>No jobs</td></tr></table>"
	    else
  	    jobs.each do |job|
  	      body += "<tr>"
  	      body += "<td>" + job.id.to_s + "</td>"
  	      body += "<td>" + job.run_at.to_s + "</td>"
  	      body += "<td>" + job.handler.to_s + "</td>"
  	      body += "<td>" + job.failed_at.to_s + "</td>"
  	      body += "<td>" + job.last_error.to_s + "</td>"
  	      body += "</tr>"
        end
      end
      body
    end
	end	

	get '/' do
		redirect "/auth/login"
	end
	
	get '/account' do
		user_must_be_logged_in
		targetuser = current_user
		if targetuser.is_administrator && params[:user_id]
			targetuser = User.get(params[:user_id])
			if (targetuser == nil)
				flash "No such user #{params[:user_id]}"
				redirect to("/admin")
			end
		end
		erb :account, {:layout => :'layout/plain'}, {:locals => { :user => targetuser }}
	end
	
	get '/admin' do
		user_must_be_admin
		erb :admin, :layout => :'layout/plain'	
	end
	
	get '/logout' do
		env['rack.session'].clear_user
		env['rack.session'].save_on_server!
		flash[:notice] = "You've logged out."
		redirect to('/')
	end

	get '/auth/login' do
		erb :login, :layout => :'layout/plain'
	end
	
	post '/auth/login' do
		env['rack.session'].clear_user
		env['rack.session'].save_on_server!

		login_id = params[:login_id]
		if !login_id || login_id.empty?
			flash.now[:error]="User id cannot be blank"
			return erb :login, :layout => :'layout/plain'
		end
		authlogin = AuthLogin.get(login_id)
		nextPage = :login
		if !authlogin
		# no login, create new user
			begin
				User.transaction do |t|
					auth = AuthLogin.create(login_id)
					user = auth.user
					env['rack.session'].user_id = user.id
					flash[:notice]="Created a new account"
				end
				redirect to("/account")
			rescue => ex
				LOGGER.error(ex.message)
				flash[:error]="Unexpected error creating the user"
				redirect to("/auth/login")
			end
		else
		# login exists, just log in
			authlogin.last_login = Time.now
			authlogin.save!
			env['rack.session'].user_id = authlogin.user_id
			flash[:notice]="Logged in successfully"
			redirect to("/account")
		end
	end
			
	get '/books/new' do
		user_must_be_logged_in
		@book = Book.new(current_user, {})
		erb :book_new, {:layout => :'layout/plain'}
	end

	delete '/books/:id' do
		book = Book.get(params[:id])
		user_must_own book
		flash[:notice] = "Book " + book.title + " was deleted";
		book.destroy
		content_type "text/plain"
	end
	
	get '/books/:id' do
		@book = Book.get(params[:id])
		user_must_own @book
		if (request.xhr?)
			content_type :json
			@book.to_json()
		else
			erb :book_editor
		end
	end

	post '/books' do
		user_must_be_logged_in
		begin
			Book.transaction do |t|
				template = BookTemplate.new(params["template"])
				@book = template.create_book(current_user, params);
				if request.xhr?
					content_type :json
					"{ \"id\" : #{@book.id} }"
				else
					redirect to("/books/#{@book.id}")
				end
			end
		rescue => ex
			LOGGER.error(ex.message)
			LOGGER.error(ex.backtrace[0..5] )
			flash.now[:error]= "Errors prevented the book from being created. Please fix them and try again."
			erb :book_new, {:layout => :'layout/plain'}
		end
	end

	get '/books/:id/pdf' do
		user_must_be_logged_in
		book = Book.get(params[:id])
		user_must_own book
		send_file book.pdf_path
	end
	
	post '/books/:id/pdf' do
		book = Book.get(params[:id])
		user_must_own book
		status = book.generate_pdf
		if request.xhr?
			flash.now[:notice] = "<a href='/books/#{book.id}/pdf'>PDF</a> conversion in progress..."
			200
		else
			[200, "PDF generation in progress..."]
		end
	end

	get '/photo/:id' do
		user_must_be_logged_in
		photo = Photo.first(:user_id => current_user.id, :id => params[:id])
		return [404, "Photo not found"] unless photo
		send_file photo.file_path(params[:size])
	end
	
	# uploads the photo, returns photo.to_json
	# if photo already exists, it discards current data, and returns original
	post '/photos' do
		user_must_be_logged_in
		assert_last_command_up_to_date(request)
		book_id = params.delete('book_id')	
		book = Book.get(book_id)
		user_must_own(book)		

		begin
			destroy_me = nil	# destroy must be outside the transaction
			photo_file = params.delete('photo_file')
			
			photo = Photo.new(params);
			photo.user_id = current_user.id
			Photo.transaction do |t|
				# save photo_file
				PhotoStorage.storeFile(photo, photo_file[:tempfile].path ) if photo_file
				photo.save
				# if there are duplicate photos, destroy this one, and use duplicate instead
				dup = Photo.first(:user_id => photo.user_id, :md5 => photo.md5, :id.not => photo.id)
				if dup
					destroy_me = photo
					photo = dup
					LOGGER.warn("duplicate photo, using old one #{photo.display_name}")
				end
				# associate photo with a book
				book = Book.get(book_id) if book_id
				if book
					book.photos << photo 
					book.save
				end
			end # transaction
			destroy_me.destroy if destroy_me
			
			# broadcast cmd
			new_last_id = ServerCommand.createAddPhotoCmd(book.id, photo, get_stream(request))
			headers "X-Sveg-LastCommandId" => String(new_last_id)
			# response
			content_type :json
			body photo.to_json
		rescue => ex
			[500, "Unexpected server error" + ex.message]
		end
	end

	post '/book_page' do
		book = Book.get(params.delete('book_id'))
		user_must_own(book)
		assert_last_command_up_to_date(request)
		begin
			page = nil
			Book.transaction do |t|
				page_position = Integer(params.delete('page_position'))
				page = PB::BookPage.new(params);
				book.insertPage(page, page_position)
				new_last_id = ServerCommand.createAddPageCmd(page, page_position, get_stream(request))
				response.headers['X-Sveg-LastCommandId'] = String(new_last_id)
			end
			content_type :json
			page.to_json
		rescue => ex
			LOGGER.error("Book validation failed " + book.errors) if ex.is_a? DataMapper::SaveFailureError
			LOGGER.error(ex.message)
			flash.now[:error]= "Errors prevented page from being saved. Contact the web site owner."
			halt 500, "Unexpected server error"
		end
	end
	
	delete '/book_page/:id' do
		user_must_be_logged_in
		page = BookPage.get(params.delete("id"))
		halt [404, "Book page not found"] unless page
		user_must_own(page.book)
		assert_last_command_up_to_date(request)
		page.destroy
		new_last_id = ServerCommand.createDeletePageCmd(page, get_stream(request))
		response.headers['X-Sveg-LastCommandId'] = String(new_last_id)
		page.destroy
		content_type "text/plain"
		"Delete successful"
	end
	
	put '/book_page/:id' do
		user_must_be_logged_in
		page = BookPage.get(params['id'])
		halt [404, "Book page not found"] unless page
		user_must_own(page.book)
		assert_last_command_up_to_date(request)
		page.update(request.params)
		new_last_id = ServerCommand.createReplacePageCmd(page, get_stream(request))
		response.headers['X-Sveg-LastCommandId'] = String(new_last_id)
		content_type "text/plain"
		"Update successful"
	end
	
	get '/assets/:template_name/:asset_file' do
		user_must_be_logged_in
		send_file BookTemplate.get(params[:template_name]).get_asset_path(params[:asset_file], params[:size] )
	end
	
	get '/templates' do
		erb :template_list, {:layout => :'layout/plain'}
	end

	get '/templates/:id' do
		content_type (request.xhr? ? :json : "text/plain")
		BookTemplate.get(params[:id]).to_json
	end
		
	# AsyncResponse = [-1, {}, []].freeze
	
	get '/cmd/stream/:book_id' do # async
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

# setup & run
  use SvegLogger
	use Rack::CommonLogger, Logger.new(File.join(SvegSettings.log_dir, "sveg.log"))
	use SessionMiddleware
	use Rack::Flash
	run! if $0 == __FILE__

end

end
