require 'fileutils'

require_relative 'utils'
require_relative 'book'
require_relative 'photo'
# PDF Generation is fully documented here, and implemented in many pieces
#
# Architecture discussion:
# PDF generation uses Chrome. Chrome has the best HTML=>PDF engine.
# Chrome is not built to be run as a command-line tool, and
# coaxing it into spitting out PDFs on demand involves a
# CONVOLUTED DATA FLOW.
#
# This is how it is done:
#
# New applications implemented:
# A) pageCapture.saveAsPDF: patch Chrome to add pageCapture.saveAsPDF js API
# B) pdf_saver_extension Chrome extension: new Chrome extension.
#    It polls pdf_saver_server for ChromePDFTask work. Converts HTML pages to PDF, sends results back to pdf_saver_server
# C) pdf_saver_server: Jobs gateway between delayed_job and chromium. Creates BookToPDFCompleteJob when tasks are done
# D) delayed_job:
#       BookToPDFPrepJob.perform creates book html files, and ChromePDFTasks
#       ChromePDFTasks are converted to PDF with pdf_saver_server and chromium
#       BookToPDFCompleteJob.perform
#       combines all page pdfs into the photo book


module PB

class ChromePDFTask < Sequel::Model(:chrome_pdf_tasks)

#	property :book_dir, String, :default => "", :length => 255 # only used to delete all files on abort
#	property :book_pdf, String, :length => 255, :required => true # used to generate final pdf
#	property :html_file, String, :length => 255, :required => true
#	property :pdf_file, String, :length => 255, :required => true
#	property :book_id, Integer, :required => true
#	property :html_file_url,String, :length => 255, :required => true
#	property :page_width, Integer,:required => true # page width
#	property :page_height, Integer,:required => true # page height

	plugin :timestamps

	STAGE_WAITING = 0 # created
	STAGE_DISPATCHED_TO_CHROME = 1 # Chrome got the message
	STAGE_DONE = 2
#	property :processing_stage, Integer, :default => STAGE_WAITING # processing stage

#	property :has_error, Boolean, :default => false
#	property :error_message, String

	def to_json(*a)
		book_json = IO.read( File.join( self.book_dir, "book.json"))
		{
			:task_id => self.id,
			:book_json => JSON.parse( book_json)
		}.to_json(*a)
	end

	def complete(options)
		job = BookToPdfCompleteJob.new(self.book_id, self.book_dir, options)
		Delayed::Job.enqueue job
	end
end

class BookToPdfCompleteJob
	def initialize(book_id, book_dir, options)
		@book_id = book_id
		@book_dir = book_dir
		@time_taken = options['totalTime']
		@error = options['error']
	end

	def book_gone_fail
		@logger.info("Book PDF conversion aborted, book is gone #{@book_id}")
		`rm -rf #{@book_dir}`
		tasks = PB::ChromePDFTask.filter(:book_id => @book_id).all
		tasks.each { |t| t.destroy }
	end

	def generic_fail(book, msg)
		@logger.error "Book PDF conversion failed {@book_id} {msg}"
		PB::ChromePDFTask.filter(:book_id => @book_id).each { |t| t.destroy }
		book.generate_pdf_fail "Unexpected PDF generation problem: #{msg}"
	end

	def get_pdf_pages
		book_json = IO.read( File.join( self.book_dir, "book.json"))
		b = JSON.parse( book_json)
		pdfs = []
		b.document.pageList.each do|file_name|
			pages.push File.join(@book_dir, file_name)
		end
		pdfs
	end

	def perform
		@logger = Delayed::Worker.logger
		@logger.info("BookToPdfCompleteJob started #{@book_id}")
		start_time = Time.now

		book = PB::Book[@book_id]
		unless book
			@logger.warn("BookToPdfCompleteJob called, but book has been deleted")
			book_gone_fail
		end
		return unless book

		if (@error)
			book.generate_pdf_fail @error
			return
		end


		pdf_files = get_pdf_pages
		book_pdf = File.join(@book_dir, "book.pdf")
		cmd_line = CommandLine.get_merge_pdfs(book_pdf, pdf_files)
		# TODO wait for files to appear in the file system
		success = Kernel.system cmd_line
		debugger unless success
		return generic_fail book, "PDF merge crashed. #{$?.to_s}" unless success
		book.generate_pdf_done(book_pdf)
		PB::ChromePDFTask.filter(:book_id => @book_id).destroy
		@logger.info("BookToPdfCompleteJob took " + (Time.now - start_time).to_s)
		rescue => ex
			book.generate_pdf_fail(ex.message) if book
			raise ex
		end
	end
end

# Book PDF generation
class BookToPdfPrepJob

	def initialize(book_id)
		@book_id = book_id
		book = PB::Book[@book_id]
		@book_json = book.to_json
	end

	def get_book_dir(book)
		dir = File.join(SvegSettings.book2pdf_dir, book.user_id.to_s, @book_id.to_s)
		FileUtils.mkdir_p(dir)
		dir
	end

	# Fix image links src="/photo/1?size=display" => src="photos/1.ext"
	def fix_html(html)
		split = html.split /(<img[^>]*>)/im
		split.each_index do |i|
			# split image into components
			match = split[i].match( /(<img[^>]*)(src=")(\/photo\/)(\d+)([^"]*)(.*)/ )
			if match
				front, href, photo, image_id, size, back = match[1], match[2], match[3], match[4], match[5], match[6]
				photo = "./photos/"
				image_id = image_id + File.extname(PB::Photo[image_id].storage)
				split[i] = front + href + photo + image_id + back
			end
		end
		split.join
	end

	def prepare_directories
		@book_dir = get_book_dir(@book)
		FileUtils.rm_r(@book_dir, :force => true); # clean the dir
		FileUtils.mkdir_p(@book_dir)
		File.open( File.join( @book_dir, "book.json" ), 'wb') do |f|
			f.write(@book_json)
		end
		# @pdf_dir = File.join(@book_dir, "pdf")
		# FileUtils.mkdir_p(@pdf_dir)
	end

	def prepare_html_files
		@html_files = []
		# copy css
		FileUtils.cp(File.join(SvegSettings.book_templates_dir, "print-sheet.css"), @book_dir);
		# copy the images
		@book.photos.each { |photo| FileUtils.cp(photo.file_path(), @photo_dir) }
		# TODO copy template images

		# create the html files
		i = 0
		index = "<html><head><title>#{@book.title}</title></head><body>"
		page_header = <<-eos
<html>
<head>
	<link href='print-sheet.css' rel='stylesheet' type='text/css' />
</head>
<body>
eos
		@book.sorted_pages.each do |page|
			i += 1
			name = "page" + i.to_s + ".html"
			html = page.html
			f = File.new(File.join(@book_dir, name), "w")
			# fix the html links
			html = self.fix_html(page.html)
			f.print page_header, html, "</body>"
			f.close()
			index << "<li><a href='#{name}'>#{name}</a>"
			@html_files << f.path
		end

		# generate index.html just for fun
		f = File.new(File.join(@book_dir,"index.html"), "w")
		f.print index, "</body>"
		f.close()
	end

	def create_pdf_files
		@pdf_files = []
		book_pdf = File.join(@book_dir, "book.pdf")
		@logger.info "Creating PDFs"
		# Create ChromePDFTask for every page
		PB::ChromePDFTask.filter(:book_id => @book.id).each { |t| t.destroy }
		@html_files.each_index do |index|
			task = PB::ChromePDFTask.new( {
				:book_id => @book.id,
				:book_dir => @book_dir
			})
			begin
				task.save
				@pdf_files << task.pdf_file
			rescue => ex
				@logger.error ex.message
				raise ex
			end
		end
	end

	# delayed_job callback. Creates the PDFs
	def perform
		begin
			@logger = Delayed::Worker.logger
			@logger.info("Book2PdfPrep started #{@book_id}");
			start_time = Time.now
			@book = PB::Book[@book_id]
			raise "No such book" unless @book
			# create book directories inside pdf-books
			prepare_directories
			task = PB::ChromePDFTask.new( {
				:book_dir => @book_dir,
				:book_json => @book_json,
				:pdf_file => File.join(@pdf_dir, File.basename(@html_files[index]).sub(".html", ".pdf")),
				:book_id => @book.id,
			})
			begin
				task.save
			rescue => ex
				@logger.error ex.message
				raise ex
			end
			# BookToPdfCompleteJob will generate the book once page pdfs have been generated
		rescue => ex
			@logger.error "BookToPdfPrepJob failed #{@book_id} #{ex.message}"
			@logger.error ex.backtrace
			@book.generate_pdf_fail(ex.message)
			PB::ChromePDFTask.filter(:book_id => @book.id).destroy
		end
	end
end

