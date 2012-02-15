# bin/rake test:all TEST=test/helper.rb

require 'config/settings'
require 'app/user'
require 'app/book'
require 'app/book_template'

module TestHelpers
	
	# logs in with given username. User created if does not exists
	def create_user(username)
		user = PB::User.first(:display_name => username)
		user = PB::AuthLogin.create(username).user unless user
		user
	end

  def create_book(options = {})
    opts = options.merge({
      :user => create_user("atotic"),
      :template_name => "modern_lines",
      :title => "Default book",
      :img_cnt => 1
    })
    template = PB::BookTemplate.new(opts[:template_name])
		book = template.create_book(opts[:user], {"title" => opts[:title], "template"=>{"name"=>opts[:template_name]}});
    assert book, "Book could not be cretated"
    Dir.glob(File.join(SvegSettings.root_dir, "test/public/*.jpg")).each do |filename|
      photo = PB::Photo.first(:display_name => File.basename(filename))
      next if opts[:img_cnt] <= 0
      unless photo
        newName = "#{filename}.jpg"
        `cp #{filename} #{newName}`
        photo = PB::Photo.create( {:display_name => File.basename(filename), :user_id => opts[:user]['id']} );
				PB::PhotoStorage.storeFile(photo, newName )
      end
			book.photos << photo
			opts[:img_cnt] -= 1
	  end
	  assert book.save, "Book could not be saved."
	  book
	end
end