# bin/rake test:all TEST=test/helper.rb

require 'rack'
require_relative '../config/settings'
require_relative '../config/db'
require_relative '../lib/sveg_lib'

module TestHelpers
	
	# logs in with given username. User created if does not exists
	def create_user(username)
		user = PB::User[:display_name => username]
		user = PB::AuthLogin.create_with_user(username).user unless user
		user
	end

	# generates a login cookie inside a cookie jar
	# session is Rack::MockSession
	def login_user(user, session)
		builder = Rack::Builder.new do
			use Rack::Session::Cookie, PB::SvegMiddleware::COOKIE_OPTIONS
			use PB::SvegMiddleware
			run lambda {|env| user.login(env); [200, {}, ['logged in']]}
		end
		env = {}
		app = builder.to_app
		status, headers, body = app.call(env)
		session.set_cookie( headers['Set-Cookie'] )
	end

	def create_book(options = {})
		opts = options.merge({
			:user => create_user("atotic"),
			:template_name => "modern_lines",
			:title => "Default book",
			:img_cnt => 1
		})
		template = PB::BookTemplate.new(opts[:template_name])
		book = template.create_book(opts[:user], opts);
		assert book, "Book could not be cretated"
		# add photos to the book if required
		Dir.glob(File.join(SvegSettings.root_dir, "test/public/*.jpg")).each do |filename|
			photo = PB::Photo.filter(:display_name => File.basename(filename)).first
			next if opts[:img_cnt] <= 0
			unless photo
				newName = "#{filename}.jpg"
				`cp #{filename} #{newName}`
				photo = PB::Photo.create( {:display_name => File.basename(filename), :user_id => opts[:user].pk} );
				PB::PhotoStorage.storeFile(photo, newName )
			end
			book.add_photo photo
			opts[:img_cnt] -= 1
		end
		assert book.save, "Book could not be saved."
		book
	end

end