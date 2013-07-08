require 'json'
require 'sequel'

module PB

class Book < Sequel::Model(:books)

	plugin :timestamps

	many_to_one :user
	many_to_many :photos
	one_to_many :chrome_pdf_tasks, :class => 'PB::ChromePDFTask'
	one_to_many :diff_stream, :class => 'PB::BookDiffStream'

	def before_create
		super
		self.title ||= 'untitled'
		self.last_diff ||= 0
		page_ids = []
		20.times { page_ids.push rand(36**6).to_s(36) }
		self.document ||=
<<-eos
{
	"title": #{self.title.to_json},
	"themeId": null,
	"photoList": [],
	"photoMap": {},
	"pageList": ["#{page_ids[0]}","#{page_ids[1]}","#{page_ids[2]}","#{page_ids[3]}","#{page_ids[4]}","#{page_ids[5]}","#{page_ids[6]}","#{page_ids[7]}"],
	"pages": {
		"#{page_ids[0]}": {"id": "#{page_ids[0]}", "assets": { "ids":[] }, "kind": "cover"},
		"#{page_ids[1]}": {"id": "#{page_ids[1]}", "assets": { "ids":[] }, "kind": "cover-flap" },
		"#{page_ids[2]}": {"id": "#{page_ids[2]}", "assets": { "ids":[] }, "kind": "back-flap" },
		"#{page_ids[3]}": {"id": "#{page_ids[3]}", "assets": { "ids":[] }, "kind": "back" },
		"#{page_ids[4]}": {"id": "#{page_ids[4]}", "assets": { "ids":[] } },
		"#{page_ids[5]}": {"id": "#{page_ids[5]}", "assets": { "ids":[] } },
		"#{page_ids[6]}": {"id": "#{page_ids[6]}", "assets": { "ids":[] } },
		"#{page_ids[7]}": {"id": "#{page_ids[7]}", "assets": { "ids":[] } }
	}
}
eos
	end

	# manual removal of all associations
	def before_destroy
		super
		chrome_pdf_tasks.each { |t| t.destroy }
		diff_stream.each { |c| c.destroy }

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
		doc = JSON.parse(self.document)
		# preload book photos
		photoIds = doc['photoList'].map { |id| doc['photoMap'][id]}
		photoJson = "[" + PB::Photo.where(:id=>photoIds).map{|x| x.to_json}.join(',') + "]"
<<-eos
{
	"id": #{self.pk},
	"last_diff" : #{self[:last_diff]},
	"document": #{self.document},
	"photos": #{photoJson}
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
