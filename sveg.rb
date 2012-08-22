#! bin/thin -C config/sveg.rb start

require 'sinatra/base'
require 'rack-flash'
require 'erb'
require 'json'
require 'base64'
require 'thin'
require 'omniauth-facebook'
require 'omniauth-google-oauth2'

require_relative 'config/settings'
require_relative 'config/db'
require_relative 'config/delayed_job'
require_relative 'lib/sveg_lib'

PB.no_warnings { Thin::SERVER = "Sveg".freeze }

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

class SvegApp < Sinatra::Base
	if SvegSettings.development?

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
			user_must_be_logged_in
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
			jobs = Delayed::Backend::Sequel::Job.all
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

		post '/auth/developer/callback' do
			omniauth = env['omniauth.auth']
			user, is_new = OmniauthToken.login_with_omniauth(omniauth)
			user.save_to_session(env, :long)
			env['x-rack.flash'][:notice] = (is_new ? \
					"thank you for joining our site" : "thank you for logging in")
			redirect '/account'
		end

	end
end


#
# Main application
#
class SvegApp < Sinatra::Base

	configure :development do
		set :show_exceptions, :false
		set :dump_errors, false
		set :raise_errors, true
	end

	configure :production do
		set :show_exceptions, false
		set :dump_errors, false
		set :raise_errors, true
		set :clean_trace, true
	end

	configure do
		set :protection, false
	end

	# extends erb method: renders mobile templates on mobile site if present
	def render_erb(template, options={}, locals={})
		# TODO layout option
		return erb(template, options, locals) unless env['sveg.mobile']

		@missed_templates = @missed_templates || {}	# keep track of missing templates

		touch_template = (template.to_s + ".touch").to_sym
		retVal = false
		unless @missed_templates.key? touch_template
			begin
				retVal = erb(touch_template, options, locals)
			rescue
				@missed_templates[touch_template] = true
			end
		end
		retVal || erb(template, options, locals)
	end

	helpers do
		include Rack::Utils

		alias_method :h, :escape_html

		def show_error(object, prop)
			"<span class=\"error_message\">#{object.errors[prop].join(" ")}</span>" if (object && !object.errors[prop].empty?)
		end

		def print_datetime(dt)
			#debugger if dt.nil?
			dt.nil? ? 'unknown' : (dt.strftime "%b %d %I:%M%p")
		end

		def json_response(object, no_cache = true)
			headers = {'Content-Type' => Rack::Mime::MIME_TYPES['.json']}
			headers['Cache-Control'] = 'no-cache' if no_cache
			[200, headers, [object.to_json]]
		end

		def plain_response(msg="")
			[200, {'Content-Type' => Rack::Mime::MIME_TYPES['.txt']}, [msg]]
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
				if arg.eql? "editor.js"
					retVal += asset_link(
						"jquery.stream-1.2.js",
						"jquery.dataSelector.js",
						"diff.js",
						"jdataview.js",
						"application.js",
						"editor.pb.js",
						"editor.pb.upload.js",
						"editor.pb.photos.js",
						"editor.pb.jpegFile.js",
						"editor.gui.js",
						"editor.gui.touch.js",
						"editor.gui.buttons.js",
						"editor.gui.controller.js",
						"editor.gui.roughworkarea.js",
						"editor.gui.photopalette.js"
						)
				elsif arg.end_with?("js")
					arg = "jquery-1.8.0.js" if arg.eql? "jquery.js"
					retVal += "<script src='/js/#{arg}'></script>\n"
				elsif arg.end_with?("css")
					retVal += "<link href='/css/#{arg}' rel='stylesheet' type='text/css' />\n"
				elsif arg.eql? "qunit"
					retVal += "<script src='http://code.jquery.com/qunit/qunit-git.js'></script>\n"
					retVal += "<link href='http://code.jquery.com/qunit/qunit-git.css' rel='stylesheet' type='text/css' />\n"
				elsif arg.eql? "bootstrap"
					retVal += asset_link( "bootstrap.css", "bootstrap.js")
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
			halt 404 if resource.nil?
			begin
				Security.user_must_own(env, resource)
			rescue RuntimeError => ex
				flash[:error] = ex.message
				if request.xhr?
					halt 401
				else
					redirect '/'
				end
			end
		end

		def user_must_have_access(resource)
			user_must_own(resource)
		end

		def assert_last_command_up_to_date(request)
			debugger if env['sveg.stream.last_command'].nil?
			halt 412, {'Content-Type' => 'text/plain'}, "You must supply last command" if env['sveg.stream.last_command'].nil?
			debugger if env['sveg.stream.last_command'] != BrowserCommand.last_command_id(env['sveg.stream.book'])
			halt 412, {'Content-Type' => 'text/plain'}, "Your last command is not up to date" if env['sveg.stream.last_command'] != BrowserCommand.last_command_id(env['sveg.stream.book'])
		end
	end # helpers

	#
	# CONTROLLER METHODS
	#
	get '/' do
		redirect "/auth/login"
	end

	get '/die' do
		raise "Died right here!"
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
		render_erb :account, {:layout => :'layout/plain'}, {:locals => { :user => targetuser }}
	end

	get '/admin' do
		user_must_be_admin
		render_erb :admin, :layout => :'layout/plain'
	end

	get '/logout' do
		PB::User.logout(env)
		flash[:notice] = "You've logged out."
		redirect to('/')
	end

	get '/auth/login' do
		render_erb :login, :layout => :'layout/plain'
	end

	# OmniAuth authentication callback
	get '/auth/:strategy/callback' do
#			return plain_response(env.to_json)
		auth_intent = :login
		login_duration = :session
		if env['omniauth.origin']
			case
				when 'omniauth.origin'.eql?('/login/session') then login_duration = :session
				when 'omniauth.origin'.eql?('/login/long') then login_duration = :long
			end
		end
		omniauth = env['omniauth.auth']
		if auth_intent == :login then
			user, is_new = OmniauthToken.login_with_omniauth(omniauth)
			user.save_to_session(env, login_duration)
			env['x-rack.flash'][:notice] = (is_new ? \
				"thank you for joining our site" : "thank you for logging in")
			redirect '/account'
		else
			# we are being authorized for something else,
			raise "Unimplemented"
		end
	end

	get '/books/new' do
		user_must_be_logged_in
		@book = Book.new({:user_id => current_user.pk})
		render_erb :book_new, {:layout => :'layout/plain'}
	end

	delete '/books/:id' do
		book = PB::Book[params[:id]]
		user_must_own book
		success = book.destroy
		flash[:notice] = success ? "Book " + book.title + " was deleted" : "Book could not be deleted."
		plain_response("")
	end

	get '/books/:id' do
		@book = PB::Book[params[:id]]
		user_must_have_access @book
		if request.xhr?
			json_response(@book)
		else
			render_erb :book_editor
		end
	end

	post '/books' do
		user_must_be_logged_in
		@book = Book.new()
		begin
			DB.transaction do
				@book.set_fields({ :user_id => current_user.pk, :title => params['title']}, [:user_id, :title])
				@book.save
				if request.xhr?
					content_type :json
					[200, {'Content-Type' => 'application/json'} ,["{ \"id\" : #{@book.id} }"]]
				else
					redirect to("/books/#{@book.id}")
				end
			end
		rescue => ex
			LOGGER.error(ex.message)
			LOGGER.error(ex.backtrace[0..5] )
			flash.now[:error]= "Errors prevented the book from being created. Please fix them and try again."
			@book = Book.new unless @book
			redirect :account
		end
	end

	patch '/books/:id' do
		@book = PB::Book[params[:id]]
		user_must_have_access @book
		str_diff = request.body.read
		json_diff = JSON.parse(str_diff)
		begin
			d = PB::BookDiffStream.apply_diff(json_diff, @book.pk)
			[200, {'Content-Type' => 'application/json'} ,["{ \"diff_id\" : #{d.pk} }"]]
		rescue => ex
			puts ex.message
			puts ex.backtrace
			[500, {'Content-Type' => 'text/plain'}, ["Document update failed for unknown reasons #{ex.message}"]]
		end
	end

	get '/books/:id/pdf' do
		book = Book[params[:id]]
		user_must_have_access book
		send_file book.pdf_path
	end

	post '/books/:id/pdf' do
		book = Book[params[:id]]
		user_must_have_access book
		status = book.generate_pdf
		if request.xhr?
			flash.now[:notice] = "<a href='/books/#{book.id}/pdf'>PDF</a> conversion in progress..."
			plain_response("")
		else
			[200, {}, "PDF generation in progress..."]
		end
	end

	get '/photo/:id' do
		photo = Photo[params[:id]]
		user_must_have_access photo
		if (params[:size].eql? 'json')
			json_response(photo)
		else
			begin
				headers['Cache-Control'] = 'max-age=84600'
				send_file photo.file_path(params[:size])
			rescue => ex
				headers['Cache-Control'] = ''
				halt [404, ["Photo in this size is not available #{params[:size]} #{photo.pk}"]]
			end
		end
	end

	# uploads the photo, returns photo.to_json
	# if photo already exists, it discards current data, and returns original
	post '/photos' do
		user_must_be_logged_in
		book_id = params.delete('book')
		photo_owner = nil
		if book_id
			book = Book[book_id]
			user_must_have_access book
			photo_owner = book.user_id
		else
			photo_owner = current_user.pk
		end
		begin
			destroy_me = nil	# destroy must be outside the transaction
			photo_file = params['photo_file']
			photo = Photo.create(:display_name => params['display_name'], :user_id => photo_owner);
			DB.transaction do
				# save photo_file
				PhotoStorage.store_file(photo, photo_file[:tempfile].path ) if photo_file
				# if there are duplicate photos, destroy this one, and use duplicate instead
				dup = Photo.filter(:user_id => photo.user_id).filter(:md5 => photo.md5).exclude(:id => photo.id).first
				if dup
					destroy_me = photo
					photo = dup
					LOGGER.warn("duplicate photo, using old one #{photo.display_name}")
				end
			end # transaction
			destroy_me.destroy if destroy_me
			# response
			json_response(photo)
		rescue => ex
			LOGGER.error "Unexpected server error" + ex.message
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
				headers(BrowserCommand.createAddPageCmd(page, page_position).broadcast(env))
			end
			json_response(page)
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
		headers(BrowserCommand.createDeletePageCmd(page).broadcast(env))
		page.destroy
		plain_response("Delete successful")
	end

	put '/book_page/:id' do
		user_must_be_logged_in
		page = PB::BookPage[params['id']]
		halt [404, "Book page not found"] unless page
		user_must_own(page.book)
		assert_last_command_up_to_date(request)
		DB.transaction do
			page.update_only(request.params, [:html,	:width, :height, :icon,:position])
			headers( BrowserCommand.createReplacePageCmd(page).broadcast(env))
		end
		plain_response("Update successful")
	end

	get '/assets/:template_name/:asset_file' do
		user_must_be_logged_in
		send_file BookTemplate.get(params[:template_name]).get_asset_path(params[:asset_file], params[:size] )
	end

	get '/templates' do
		render_erb :template_list, {:layout => :'layout/plain'}
	end

	get '/templates/:id' do
		template = BookTemplate.get(params[:id])
		json_response(template)
	end

	get '/subscribe/book/:book_id' do # async
		LOGGER.error "Subscriptions should be forwarded to comet"
		redirect "http://#{SvegSettings.comet_host}:#{SvegSettings.comet_port}/subscribe/book/#{params[:book_id]}?#{env['QUERY_STRING']}"
	end

# setup & run
	access_log_file = ::File.new(File.join(SvegSettings.log_dir, "sveg_access.#{PB.get_thin_server_port}.log" ), 'a')
	access_log_file.sync= true
	use Rack::CommonLogger, access_log_file
	use Rack::ShowExceptions if SvegSettings.development?
	use Rack::Session::Cookie, PB::SvegMiddleware::COOKIE_OPTIONS
	use OmniAuth::Builder do
		provider :developer if SvegSettings.development?
		provider :facebook, PB::Secrets::FB_APP_ID, PB::Secrets::FB_SECRET, :scope => 'email,'
		provider :google_oauth2, PB::Secrets::GOOGLE_KEY, PB::Secrets::GOOGLE_SECRET, {}
	end
	use Rack::Flash
	use PB::SvegMiddleware
end

end

Sveg = PB::SvegApp.new
