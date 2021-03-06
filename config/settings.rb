# Common settings, used by all sveg servers and scripts
raise "RACK_ENV must be set (user:#{ENV['USER']})" unless ENV.has_key?('RACK_ENV')

ENV['RAILS_ENV'] = ENV['RACK_ENV'] # some gems (delayed_job) need this

# gem requires
require 'bundler/setup'
require_relative './secrets'

# server code

class SvegSettings
	# platform
	@platform = case
		when RUBY_PLATFORM.include?('darwin') then :mac
		when RUBY_PLATFORM.include?('linux') then :linux
		else "Unknown platform"
	end
	# directories
	# @root_dir = ENV['PB_ROOT_DIR'] || File.dirname(File.dirname(File.expand_path(__FILE__))).freeze
	@root_dir = File.dirname(File.dirname(File.expand_path(__FILE__))).freeze
	@pb_chrome_dir = ENV['PB_CHROME_DIR'] || File.expand_path('../pb_chrome', @root_dir)
	@pb_templates_dir = ENV['PB_TEMPLATES_DIR'] || File.expand_path('../pb_templates', @root_dir)

	@environment = ( ENV['RACK_ENV'] || :development ).to_sym # :production :development :test
	raise "RACK_ENV must be production|development|test" unless @environment == :development || @environment == :production || @environment == :test
	@book_templates_dir = File.expand_path("./templates", @pb_templates_dir).freeze
	@test_dir = File.join(@root_dir, "test").freeze
	@data_dir = ENV['PB_DATA_DIR'] || File.join(File.expand_path('../pb_data', @root_dir), @environment.to_s).freeze
	@tmp_dir = File.join(@data_dir, 'tmp').freeze
	@log_dir = File.join(@data_dir, 'log').freeze
	@chrome_log_dir = File.join(@log_dir, 'chrome').freeze

	@photo_dir = File.join(@data_dir, 'photo-storage').freeze # photo storage directory
	@book2pdf_dir = File.join(@data_dir, 'pdf-books').freeze # generated books

	# binaries
	@chrome_profile_dir = File.join(@pb_chrome_dir, 'profile')
	@chrome_extension_dir = File.join(@pb_chrome_dir, 'pdf_saver_extension', 'extension')
	if @platform == :mac
		@chrome_binary = File.join(@pb_chrome_dir, 'bin/mac/Chromium.app/Contents/MacOS/Chromium').freeze
		@chrome_dir = File.join(@pb_chrome_dir, 'bin/mac//Chromium.app').freeze
		@pdf_toolkit_binary = (@environment == :production ? "/usr/bin/pdftk" : "/usr/local/bin/pdftk").freeze
		@convert_binary = "/usr/local/bin/convert".freeze
		@graphicsmagick_binary = "/usr/local/bin/gm".freeze
		@exiv2_binary = "/usr/local/bin/exiv2".freeze
		@python_binary = "/usr/bin/python".freeze
		@psql_binary = "/usr/bin/psql".freeze
	elsif @platform == :linux
		@chrome_binary = File.join(@pb_chrome_dir, "bin/linux_64/chrome").freeze
		@chrome_dir = File.join(@pb_chrome_dir, "bin/linux_64").freeze
		@pdf_toolkit_binary = "/usr/bin/pdftk".freeze
		@convert_binary = "/usr/bin/convert".freeze
		@graphicsmagick_binary = "/usr/bin/gm".freeze
		@exiv2_binary = "/usr/bin/exiv2".freeze
		@python_binary = "/usr/bin/python".freeze
		@psql_binary = "/usr/bin/psql".freeze
	end
	@face_script = File.join(@root_dir, 'face_detect', 'pookioface.py').freeze
	#
	@comet_port = 28000
	@comet_host = "localhost"
	@postgres_host = 'localhost'

	class << self
		attr_accessor :root_dir,:data_dir, :tmp_dir, :log_dir, :test_dir
		attr_accessor :environment, :platform
		attr_accessor :book_templates_dir, :photo_dir, :book2pdf_dir
		attr_accessor :chrome_binary, :chrome_dir, :chrome_log_dir, :chrome_profile_dir, :chrome_extension_dir
		attr_accessor :convert_binary, :graphicsmagick_binary, :exiv2_binary, :python_binary, :pdf_toolkit_binary
		attr_accessor :psql_binary
		attr_accessor :face_script
		attr_accessor :comet_port, :comet_host
		attr_accessor :postgres_host
	end

	def self.init()
		Dir.mkdir(@data_dir) unless File.exists?(@data_dir)
		Dir.mkdir(@tmp_dir) unless File.exist?(@tmp_dir)
		Dir.mkdir(@log_dir) unless File.exists?(@log_dir)
		Dir.mkdir(@photo_dir) unless File.exists?(@photo_dir)
		Dir.mkdir(@book2pdf_dir) unless File.exists?(@book2pdf_dir)
		Dir.mkdir(@chrome_log_dir, 0777) unless File.exists?(@chrome_log_dir)
	end

	def self.development?
		@environment == :development
	end

	def self.production?
		@environment == :production
	end

	def self.test?
		@environment == :test
	end

	def self.mac?
		@platform == :mac
	end

	def self.linux?
		@platform == :linux
	end
end

SvegSettings.init()

if SvegSettings.development?
	require_relative 'debug'
end
