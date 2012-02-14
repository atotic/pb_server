require 'dm-core'
require 'dm-validations'
require 'dm-migrations'
require 'dm-timestamps'
require 'json'

require 'app/user'
require 'app/photo'
require 'app/book_template'
require 'app/command_stream'

require 'config/delayed_job'

module PB
	
class Book
	include DataMapper::Resource
	
	property :id,					 Serial 
	property :created_at,		DateTime
	property :updated_at,		DateTime
	
	property :title,				String,	 :length => 255, :required => true
	property :pdf_location,	String, :length => 255
	property :pdf_generate_error, String, :length => 255
	property :pdf_generate_in_progress, Boolean, :default => false
	property :page_order, Text, :lazy => false	# comma separated list of page ids.
	property :template_name, String, :length => 255 # name of the template
	property :template,	 Text, :lazy => false	# template attributes, stored as json
	
	belongs_to :user
	has n, :pages, 'BookPage'
	has n, :photos, :through => Resource
		
	validates_with_method :pages, :method => :validate_pages
	
	#
	# *args are either:
	# [ user, {attributes}]
	# or [] for default book
	def initialize(*args)
		case
		when args.length == 0
			super({})
		when args.length == 2
			super(args[1])
			self.user = args[0]
		else
			raise "Book must have a user"
		end
	end
	
	# manual removal of all associations
	def destroy_dependents
		pages.destroy
		# find photos that belong to book only  using SQL
		# select photo_id from 
		#  (select count() as cnt ,photo_id,book_id from pb_book_photos group by photo_id) 
		# where cnt == 1 and book_id == #{book['id']}

		# save photo list, so we can traverse it
		p = photos.all.collect { |x| x }
		# destroys the association
    book_photos.destroy
		p.each do |photo|
			# destroy photos if we are the only book
			success = true
			success = photo.destroy if photo.books.count == 0
			LOGGER.error "Could not destroy photo #{photo.id}" unless success
		end
	end
	
	# template is set as a hash, but retreived as an array
	def template=(new_template)
		self.template_name = new_template["name"]
		new_template = new_template.to_json unless template.is_a? String
		super(new_template)
	end
	
	def to_json(*a)
		last_cmd = ServerCommand.last(:book_id => self.id)
		{
			:id => self.id,
			:title => self.title,
			:pages => self.pages.to_a,
			:photos => self.photos.to_a,
			:page_order => self.page_order.split(",").map { |x| x.to_i },
			:template_id => self.template_name,
			:last_server_cmd_id => (last_cmd ? last_cmd.id : 0)
		}.to_json(*a)
	end
	
	def get_template
		BookTemplate.new(JSON.parse(self.template_attributes))
	end
	
	def validate_template_attributes
		begin
			template = self.get_template
		rescue => e
			return [false, e.message]
		end
		true
	end
	
	def validate_pages
		self.pages.each do |page|
				return [false, "Invalid book page #{page.errors.full_messages.join(";")}"] unless page.valid?
		end
		true
	end
	
	def pdf_path
		self.pdf_location
	end

	def insertPage(page, page_number)
		page_number ||= 0;
		self.pages << page
		page.save # id is created here
		if self.page_order
			self.page_order += ","
		else
			self.page_order = ""
		end
		self.page_order = self.page_order.split(',').insert(page_number, page.id).join(',') 
		self.save
	end
	
	def generate_pdf(force = false)
	  return "Book PDF generation not started. There is already a build in progress." if self.pdf_generate_in_progress && !force
	  self.pdf_location = nil
	  self.pdf_generate_error = nil
	  self.pdf_generate_in_progress = true
	  save
	  Delayed::Job.enqueue BookToPdfPrepJob.new(self.id)
	  return "Book PDF proof will be ready in a few minutes."
  end
  
  def generate_pdf_done(pdf_path)
    self.pdf_location = pdf_path
    self.pdf_generate_error = nil
    self.pdf_generate_in_progress = false
    self.save
  end
  
  def generate_pdf_fail(err_msg)
    self.pdf_location = ""
    self.pdf_generate_error = err_msg[0..49]
    self.pdf_generate_in_progress = false
    begin
      self.save
    rescue => ex
      puts ex.message
      puts ex.backtrace
      puts self.errors
    end
  end
end

class BookPage
	include DataMapper::Resource
	
	property :id,					 Serial 
	property :created_at,		DateTime
	property :updated_at,		DateTime

	property :html,					Text, :lazy => false
	property :width,				String # css width units px|in|cm etc
	property :height,				String # css width units
	property :icon,					Text, :lazy => false # html icon
	property :position,			String # page position (see template): cover|flap|inside|middle|back

	belongs_to :book
	
	before :destroy, :remove_from_page_order
	def to_json(*a)
		{
			:id => self.id,
			:width => self.width,
			:height => self.height,
			:html => self.html,
			:icon => self.icon,
			:position => self.position
		}.to_json(*a)
	end
	
	def remove_from_page_order
		b = self.book
		page_order = b.page_order.split(",")
		page_order.delete(self.id.to_s)
		b.page_order = page_order.join(',')
	end
end

end
