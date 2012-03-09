#! bin/thin -C config/sveg.yml start
require 'config/settings'

#Debugger.settings[:autoeval] = true
#Debugger.settings[:autolist] = true

require 'sinatra/base'
require 'rack-flash'
require 'erb'
require 'json'
require 'base64'

require 'config/settings'
require 'config/db'
require 'svegutils'

require 'app/book'
require 'app/user'
require 'app/photo'
require 'app/book_template'
require 'app/command_stream'

# Quick and dirty shutdown
# EventMachine takes about 10s to close my local streaming connection, too long for dev cycle
module Sinatra
	class Base
		class << self
			alias old_quit! quit!
			def quit!(server, handler_name)
				old_quit!(server, handler_name)
#				Kernel.abort("Sveg's quick exit")
			end
		end
	end
end

module PB


LOGGER = PB.create_server_logger('sveg')

#
# Main application
#
class SvegApp < Sinatra::Base

	set :show_exceptions, true if SvegSettings.environment == :development
	set :dump_errors, true if SvegSettings.environment == :development

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
			env['sveg.user']
		end

		def user_must_be_logged_in
			begin
				Security.user_must_be_logged_in(env)
			rescue RuntimeError
				flash[:error] = "You must be logged in to access #{env['REQUEST_PATH']}."
				if request.xhr? 
					halt 401
				else 
					redirect_back
				end
			end
		end

		def user_must_be_admin
			begin
				Security.user_must_be_admin(env)
			rescue RuntimeError
				flash[:notice] = "You must be an administrator to access that page."
				redirect_back
			end
		end
		
		def user_must_own(resource)
			begin
				Security.user_must_own(env, resource)
			rescue RuntimeError => ex
				flash[:error] = ex.message
				halt 401
			end
		end
			
		def assert_last_command_up_to_date(request)
			halt 412, {'Content-Type' => 'text/plain'}, "You must supply last command" if env['sveg.stream.last_command'].nil?
			halt 412, {'Content-Type' => 'text/plain'}, "Your last command is not up to date" if env['sveg.stream.last_command'] != BrowserCommand.last_command_id(env['sveg.stream.book'])
		end
	end # helpers

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
#			r.each { |x| body += x[:key] + " " + x[:path] + " " + x[:vars].join(" ") + "\n"}
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
					body += "<td><pre>" + job.last_error.to_s + "</pre></td>"
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
			targetuser = PB::User[params[:user_id]]
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
		PB::User.logout(env)
		flash[:notice] = "You've logged out."
		redirect to('/')
	end

	get '/auth/login' do
		erb :login, :layout => :'layout/plain'
	end
	
	post '/auth/login' do
		PB::User.logout(env)

		login_id = params[:login_id]
		if !login_id || login_id.empty?
			flash.now[:error]="User id cannot be blank"
			return erb :login, :layout => :'layout/plain'
		end
		authlogin = AuthLogin[login_id]
		nextPage = :login
		if !authlogin
		# no login, create new user
			begin
				DB.transaction do
					auth = AuthLogin.create_with_user(login_id)
					user = auth.user
					user.login(env)
					flash[:notice]="Created a new account"
				end
				redirect to("/account")
			rescue => ex
				LOGGER.error(ex.message)
				ex.backtrace
				flash[:error]="Unexpected error creating the user"
				redirect to("/auth/login")
			end
		else
		# login exists, just log in
			authlogin.last_login = Time.now
			authlogin.save
			authlogin.user.login(env)
			flash[:notice]="Logged in successfully"
			redirect to("/account")
		end
	end
			
	get '/books/new' do
		user_must_be_logged_in
		@book = Book.new({:user_id => current_user.pk})
		erb :book_new, {:layout => :'layout/plain'}
	end

	delete '/books/:id' do
		book = PB::Book[params[:id]]
		user_must_own book
		success = book.destroy
		flash[:notice] = success ? "Book " + book.title + " was deleted" : "Book could not be deleted."
		content_type "text/plain"
	end
	
	get '/books/:id' do
		@book = PB::Book[params[:id]]
		user_must_own @book
		if request.xhr?
			content_type :json
			@book.to_json
		else
			erb :book_editor
		end
	end

	post '/books' do
		user_must_be_logged_in
		begin
			DB.transaction do
				template = BookTemplate.new(params["template"])
				@book = template.create_book(current_user, params["book"]);
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
			@book = Book.new unless @book
			erb :book_new, {:layout => :'layout/plain'}
		end
	end

	get '/books/:id/pdf' do
		user_must_be_logged_in
		book = Book[params[:id]]
		user_must_own book
		send_file book.pdf_path
	end
	
	post '/books/:id/pdf' do
		book = Book[params[:id]]
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
		photo = Photo.filter(:user_id => current_user.pk).filter(:id => params[:id]).first
		return [404, "Photo not found"] unless photo
		send_file photo.file_path(params[:size])
	end
	
	# uploads the photo, returns photo.to_json
	# if photo already exists, it discards current data, and returns original
	post '/photos' do
		user_must_be_logged_in
		assert_last_command_up_to_date(request)
		book_id = params.delete('book_id')	
		book = Book[book_id]
		user_must_own(book)		

		begin
			destroy_me = nil	# destroy must be outside the transaction
			photo_file = params.delete('photo_file')
			
			photo = Photo.new(params);
			photo.user_id = current_user.pk
			DB.transaction do 
				# save photo_file
				PhotoStorage.storeFile(photo, photo_file[:tempfile].path ) if photo_file
				photo.save
				# if there are duplicate photos, destroy this one, and use duplicate instead
				dup = Photo.filter(:user_id => photo.user_id).filter(:md5 => photo.md5).exclude(:id => photo.id).first
				if dup
					destroy_me = photo
					photo = dup
					LOGGER.warn("duplicate photo, using old one #{photo.display_name}")
				end
				# associate photo with a book
				book = Book[book_id] if book_id
				if book
					book.add_photo photo 
					book.save
				end
			end # transaction
			destroy_me.destroy if destroy_me
			
			# broadcast cmd
			new_last_id = BrowserCommand.createAddPhotoCmd(book.id, photo, env['sveg.stream.id'])
			headers "X-Sveg-LastCommandId" => String(new_last_id)
			# response
			content_type :json
			body photo.to_json
		rescue => ex
			[500, "Unexpected server error" + ex.message]
		end
	end

	post '/book_page' do
		book = Book[params.delete('book_id')]
		user_must_own(book)
		assert_last_command_up_to_date(request)
		begin
			page = nil
			DB.transaction do 
				page_position = Integer(params.delete('page_position'))
				page = PB::BookPage.new(params);
				book.insertPage(page, page_position)
				new_last_id = BrowserCommand.createAddPageCmd(page, page_position, env['sveg.stream.id'])
				response.headers['X-Sveg-LastCommandId'] = String(new_last_id)
			end
			content_type :json
			page.to_json
		rescue => ex
			LOGGER.error(ex.message)
			flash.now[:error]= "Errors prevented page from being saved. Contact the web site owner."
			halt 500, "Unexpected server error"
		end
	end
	
	delete '/book_page/:id' do
		user_must_be_logged_in
		page = PB::BookPage[params.delete("id")]
		halt [404, "Book page not found"] unless page
		user_must_own(page.book)
		assert_last_command_up_to_date(request)
		new_last_id = BrowserCommand.createDeletePageCmd(page, env['sveg.stream.id'])
		response.headers['X-Sveg-LastCommandId'] = String(new_last_id)
		page.destroy
		content_type "text/plain"
		"Delete successful"
	end
	
	put '/book_page/:id' do
		user_must_be_logged_in
		page = PB::BookPage[params['id']]
		halt [404, "Book page not found"] unless page
		user_must_own(page.book)
		assert_last_command_up_to_date(request)
		DB.transaction do
			page.update_only(request.params, [:html,	:width, :height, :icon,:position])
			new_last_id = BrowserCommand.createReplacePageCmd(page, env['sveg.stream.id'])
			response.headers['X-Sveg-LastCommandId'] = String(new_last_id)
		end
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
	use Rack::CommonLogger, File.join(SvegSettings.log_dir, "sveg.log" ) 
	use Rack::Session::Cookie, PB::SvegSession::COOKIE_OPTIONS
	use Rack::Flash
	use PB::SvegSession
end

end

Sveg = PB::SvegApp.new