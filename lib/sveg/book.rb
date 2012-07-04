require 'json'
require 'sequel'

module PB

class Book < Sequel::Model(:books)

	plugin :timestamps

	many_to_one :user
	many_to_many :photos
	one_to_many :chrome_pdf_tasks, :class => 'PB::ChromePDFTask'
	one_to_many :browser_commands, :class => 'PB::BrowserCommand'

	def before_create
		super
		self.title ||= 'untitled'
		self.document ||=
<<-eos
{
	"title": #{self.title.to_json},
	"photoList": ["A","B","C","D", "E"],
	"photos": {
		"A": { "url": { "l": "/assets/test/1.jpg"} },
		"B": { "url": { "l": "/assets/test/2.jpg"} },
		"C": { "url": { "l": "/assets/test/3.jpg"} },
		"D": { "url": { "l": "/assets/test/4.jpg"} },
		"E": { "url": { "l": "/assets/test/5.jpg"} }
		},
	"roughPageList": ["cover", "cover-flap", "back-flap", "back","1","2","3","4"],
	"roughPages": {
		"cover": { "photoList": [] },
		"cover-flap": { "photoList": [] },
		"back-flap": { "photoList": [] },
		"back": {"photoList": [] },
		"1": {"photoList": ["A", "B"] },
		"2": {"photoList": ["B", "C"] },
		"3": {"photoList": ["D"] },
		"4": {"photoList": [] }
	}
}
eos
	end

	# manual removal of all associations
	def before_destroy
		super
		chrome_pdf_tasks.each { |t| t.destroy }
		browser_commands.each { |c| c.destroy }

		# save photo list, so we can traverse it
		p = photos.collect { |x| x }
		# destroys the association
		remove_all_photos
		# remove orphan photos
		p.each do |photo|
			# destroy photos if we are the only book
			success = true
			success = photo.destroy if photo.books.count == 0
			PB.logger.error "Could not destroy photo #{photo.id}" unless success
		end
	end

	def validate
		super
	end

	def to_json(*a)
		# TODO insert photos into document
<<-eos
{
	'id': #{self.pk},
	'last_server_cmd_id' : #{BrowserCommand.last_command_id(self.pk)},
	'document': #{self.document}
}
eos
	end

	def pdf_path
		self.pdf_location
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

	def apply_diff(json_diff)
		oldDoc = JSON.parse(self.document)
		PB.logger.debug("Applying diff #{json_diff}")
		self[:document] = JsonDiff.patch(oldDoc, json_diff).to_json
		self.save_changes
		PB.logger.debug("Diff successful")
	end
end

class BookPage < Sequel::Model(:book_pages)

#	property :id,					 Serial
#	property :created_at,		DateTime
#	property :updated_at,		DateTime

#	property :html,					Text, :lazy => false
#	property :width,				String # css width units px|in|cm etc
#	property :height,				String # css width units
#	property :icon,					Text, :lazy => false # html icon
#	property :position,			String # page position (see template): cover|flap|inside|middle|back

	plugin :timestamps


	def to_json(*a)
		{
			:id => self.pk,
			:width => self.width,
			:height => self.height,
			:html => self.html,
			:icon => self.icon,
			:position => self.position
		}.to_json(*a)
	end

	def before_destroy
		# removes page from book page order
		b = self.book
		page_order = b.page_order.split(",")
		page_order.delete(self.pk.to_s)
		b.page_order = page_order.join(',')
		b.save
	end
end

end
