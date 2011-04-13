require 'rubygems'
require 'sinatra/base'
require 'erb'
require 'logger'
require 'json'
require 'base64'
require 'dm-validations'
require 'dm-core'
require 'dm-migrations'
require 'dm-transactions'
require 'data_objects'
require 'rack-flash'

require 'ruby-debug'

# sveg requires
require 'model/book'
require 'model/user'

# logging
class ColorLogger < Logger
	def initialize()
		super(STDOUT)
		self.datetime_format = ""
	end

	def warn(msg)
		printf STDOUT, "\033[33m";super;printf STDOUT, "\033[0m"
	end

	def error(msg)
		printf STDOUT, "\033[31m";super;printf STDOUT, "\033[0m"
	end
end

class SvegLogger
	FORMAT = %{ %s"%s %s%s %s" %s %0.4f\n}
	def initialize(app)
		@app = app
		@logger = STDERR
	end

	def call(env)
		began_at = Time.now
		status, header, body = @app.call(env)
		log(env, status, began_at)
		[status, header, body]
	end

	def log(env, status,began_at)
		now = Time.now

		logger = @logger || env['rack.errors']
		return if env['sinatra.static_file']
		STDERR.write "HTTP ERROR" if status >= 400
		logger.write FORMAT % [
			env["REMOTE_USER"] || "-",
			env["REQUEST_METHOD"],
			env["PATH_INFO"],
			env["QUERY_STRING"].empty? ? "" : "?"+env["QUERY_STRING"],
			env["HTTP_VERSION"],
			status.to_s[0..3],
			now - began_at ]
	end
end

LOGGER = ColorLogger.new

# Our sessions
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
		@expires = Time.now + 60
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
		save_session(env, headers, request)
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

DataMapper::Model.raise_on_save_failure = true
# Use either the default Heroku database, or a local sqlite one for development
DataMapper.setup(:default, ENV['DATABASE_URL'] || "sqlite3://#{Dir.pwd}/development.db")
DataMapper.finalize
DataMapper.auto_upgrade!
#DataMapper.auto_migrate!

#
# Main application
#
class SvegApp < Sinatra::Base

	set :root, File.dirname(__FILE__)
	set :templates, File.join(settings.root, "templates"); # book template directory
	set :show_exceptions, true

	helpers do
		include Rack::Utils
		
		# Utils
		
		alias_method :h, :escape_html
		
		def show_error(object, prop)
			"<span class=\"error_message\">#{object.errors[prop]}</span>" if (object.errors[prop])
		end
		
		def print_datetime(dt)
			dt.strftime "%b %d %I:%M%p"
		end
		
		def redirect_back
			redirect request.referer.end_with?(request.path_info) ? "/" : request.referer
		end

		# args are a list of resources 
		# ex: asset_link("jquery.js", "jquery-ui.js", "application.css")
		def asset_link(*args)
			retVal = "";		
			args.each do |arg|
				arg = arg.to_s if arg.is_a?(Symbol)
				if arg.end_with?("js")
					arg = "jquery-1.5.js" if arg.eql? "jquery.js"
					arg = "jquery-ui-1.8.9.custom.js" if arg.eql? "jquery-ui.js"
					retVal += "<script src='/javascripts/#{arg}'></script>\n"				
				elsif arg.end_with?("css")
					arg = "smoothness/jquery-ui-1.8.9.custom.css" if arg.eql? "jquery-ui.css"
					retVal += "<link href='/stylesheets/#{arg}' rel='stylesheet' type='text/css' />"
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
			flash[:error] = "Resource not found" && redirect_back unless resource
			
			if current_user.id != resource.user_id && !current_user.is_administrator
				flash[:error]="Access not allowed."
				redirect_back
			end
		end

	end

	after do
		if request.xhr?
			headers({"X-FlashError" => flash[:error]}) if flash[:error]
			headers({"X-FlashNotice" => flash[:notice]}) if flash[:notice]
		end
	end

	#
	# CONTROLLER METHODS
	#

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
					user = User.new({:display_name => login_id})
					user.is_administrator = true if login_id.eql? "atotic"
					user.save
					auth = AuthLogin.new({:login_id => login_id, :user_id => user.id} )
					auth.save
					env['rack.session'].user_id = user.id
					flash[:notice]="Created a new account"
				end
				redirect to("/account")
			rescue => ex
				LOGGER.error(ex.message)
				flash[:error]="Unexpected error creating the user"
				redirect to("/login")
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

	get '/editor' do
		user_must_be_logged_in
		erb :editor
	end
	
	get '/editor/:book_id' do
		user_must_be_logged_in
		book = Book.get(params[:book_id])
		user_must_own book
		erb :editor
	end
	
	get '/books/new' do
		user_must_be_logged_in
		@book = Book.new(current_user, {}, {})
		erb :book_new
	end

	get '/books/:id' do
		@book = Book.get(params[:id])
		user_must_own @book
		content_type :json
		@book.to_json()
	end

	post '/books' do
		user_must_be_logged_in
		begin
			Book.transaction do |t|
				@book = Book.new(current_user, params[:book], params[:template])
				@book.init_from_template
				content_type :json
				"{ \"id\" : #{@book.id} }"
			end
		rescue => ex
			LOGGER.error(ex.message)
			flash.now[:error]= "Errors prevented the book from being saved. Please fix them and try again."
			[400, erb(:book_new)]
		end
	end

# setup & run	
	use SvegLogger
	use SessionMiddleware
	use Rack::Flash
	run! if app_file == nil

end