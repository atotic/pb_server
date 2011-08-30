# http://glu.ttono.us/articles/2005/10/30/why-and-how-ruby-and-rails-unit-testing
# http://en.wikibooks.org/wiki/Ruby_Programming/Unit_testing

ENV['RACK_ENV'] = 'test'

require 'test/unit'
require 'rack/test'
require 'sveg'
require 'model/user'

Sinatra::Base.set :environment, :test

class Test::Unit::TestCase
  include Rack::Test::Methods

	def app
		SvegApp.new
	end
	
	def login(user)
		user = user || User.first
		ENV['rack.session'].user_id = user.id
	end
	
	# seed the database
	def seed
		# users
		AuthLogin.create('atotic') if User.count < 1
		user = User.first
		# books
		book = user.books.first
		unless book
			book = Book.new(user, { :title => "Seed book 1"}, { :style=> "6x6"} )
			book.init_from_template			
		end
		# photos
		test_photo_dir = "./test/photo"
		temp_name = "./test/tmp.jpg"
		
		Dir.foreach(test_photo_dir) do |filename|
			next if Photo.first(:display_name => filename)
			next if File.extname(filename).empty?
			puts filename
			photo = Photo.new({:display_name => filename} );
			photo.user_id = user.id
			FileUtils.copy_file( File.join(test_photo_dir, filename), temp_name)
			PhotoStorage.storeFile(photo, temp_name)
			photo.save
			book.photos << photo 
			book.save
		end
	end

end