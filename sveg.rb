require 'rubygems'
require 'ruby-debug'

require 'sinatra/base'
require 'erb'
require 'logger'
require 'json'
require 'base64'

require 'dm-core'
require 'dm-validations'
require 'dm-migrations'
require 'dm-transactions'
require 'data_objects'
require 'rack-flash'

# sveg requires
require 'model/book'
require 'model/user'
require 'model/photo'
require 'model/book_template'
require 'jobs/book2pdf'

module PB
	
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
#		return if env['sinatra.static_file']
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


#
# Main application
#
class SvegApp < Sinatra::Base

	set :root, File.dirname(__FILE__)
	set :test_root, File.join(settings.root, "test")
	set :templates, File.join(settings.root, "book-templates"); # book template directory

	set :show_exceptions, true

	def initialize(*args)
		super(args)
		DataMapper::Model.raise_on_save_failure = true
		# Use either the default Heroku database, or a local sqlite one for development
		database_url = ENV['DATABASE_URL'] || "sqlite3://#{Dir.pwd}/development.sqlite";
		database_url = "sqlite3://#{Dir.pwd}/test/test.sqlite" if settings.environment == :test
#		database_url = "sqlite3::memory:" if settings.environment == :test
		DataMapper.setup(:default, database_url)
		DataMapper.finalize
		DataMapper.auto_upgrade! # extends tables to match model
		#DataMapper.auto_migrate!  # blows up database
		SvegApp.set :photo_dir, File.join(settings.root, "photo-storage"); # photo storage directory
		SvegApp.set :book2pdf_dir, File.join(settings.root, "pdf-books"); # generated books
		# Testing setup
		if settings.environment == :test
			SvegApp.set :photo_dir, File.join(File.dirname(settings.photo_dir), "test", File.basename(settings.photo_dir))
			SvegApp.set :book2pdf_dir, File.join(File.dirname(settings.book2pdf_dir), "test", File.basename(settings.book2pdf_dir))
		end
	end
	
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
					arg = "jquery-1.6.4.js" if arg.eql? "jquery.js"
					arg = "jquery-ui-1.8.16.custom.js" if arg.eql? "jquery-ui.js"
					retVal += "<script src='/javascripts/#{arg}'></script>\n"				
				elsif arg.end_with?("css")
					arg = "smoothness/jquery-ui-1.8.16.custom.css" if arg.eql? "jquery-ui.css"
					retVal += "<link href='/stylesheets/#{arg}' rel='stylesheet' type='text/css' />\n"
				elsif arg.eql? "qunit"
					retVal += "<script src='http://code.jquery.com/qunit/qunit-git.js'></script>\n"
					retVal += "<link href='http://code.jquery.com/qunit/qunit-git.css' rel='stylesheet' type='text/css' />\n"
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
			unless resource
				flash[:error] = "Resource not found."
				if (request.xhr?)
					halt 404
				else
					redirect_back
				end
			end
			if current_user.id != resource.user_id && !current_user.is_administrator
				flash[:error]="Access not allowed."
				if request.xhr?
					halt 401
				else
					redirect_back
				end
			end
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
		erb :book_new, {:layout => :'layout/plain'}
	end

	delete '/books/:id' do
		user_must_be_logged_in
		book = Book.get(params[:id])
		user_must_own book
		flash[:notice] = "Book " + book.title + " was deleted";
		book.destroy
		content_type "text/plain"
		
	end
	
	get '/books/:id' do
		book = Book.get(params[:id])
		user_must_own book
		content_type :json
		book.to_json()
	end

	post '/books' do
		user_must_be_logged_in
		begin
			Book.transaction do |t|
				@book = Book.new(current_user, params[:book], params[:template])
				@book.init_from_template
				if request.xhr?
					content_type :json
					"{ \"id\" : #{@book.id} }"
				else
					redirect to("/editor/#{@book.id}")
				end
			end
		rescue => ex
			LOGGER.error(ex.message)
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
		BookToPdf.new.process(book.id)
		if request.xhr?
			flash.now[:notice] = "<a href='/books/#{book.id}/pdf'>PDF</a> being generated"
			200
		else
			[200, "PDF generation in progress..."]
		end
	end
	
	# get photo
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
		begin
			destroy_me = nil	# destroy must be outside the transaction
			photo_file = params.delete('photo_file')
			book_id = params.delete('book_id')
		
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
			content_type :json
			photo.to_json				
		rescue => ex
			[500, "Unexpected server error" + ex.message]
		end
	end

	put '/book_page/:id' do
		user_must_be_logged_in
		page = BookPage.get(params.delete("id"))
		halt [404, "Book page not found"] unless page
		user_must_own(page.book)
		page.update(params)
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

# setup & run	
	use SvegLogger
	use SessionMiddleware
	use Rack::Flash
	run! if $0 == __FILE__

end

end
