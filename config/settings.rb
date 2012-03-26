# Common settings, used by all sveg servers and scripts

ENV['RACK_ENV'] = 'development' unless ENV.has_key? 'RACK_ENV'
ENV['RAILS_ENV'] = ENV['RACK_ENV']

# gem requires
require 'bundler/setup'

# server code

class SvegSettings
	
	# directories
	@root_dir = File.dirname(File.dirname(File.expand_path(__FILE__))).freeze
	@pb_chrome_dir = File.expand_path('../pb_chrome', @root_dir)
	@pb_templates_dir = File.expand_path('../pb_templates', @root_dir)

	@environment = ( ENV['RACK_ENV'] || :development ).to_sym # :production :development :test
	@book_templates_dir = File.expand_path("./templates", @pb_templates_dir).freeze
	@test_dir = File.join(@root_dir, "test").freeze
	
	@data_dir = @environment == :test ? File.join(@root_dir, "test", "data") : File.join(@root_dir, "data")
	@data_dir.freeze
	@tmp_dir = File.join(@data_dir, "tmp").freeze
	@log_dir = File.join(@data_dir, "log").freeze

	@photo_dir = File.join(@data_dir, "photo-storage").freeze # photo storage directory
	@book2pdf_dir = File.join(@data_dir, "pdf-books").freeze # generated books
	
	# binaries
#	@chrome_binary = "/Users/atotic/chromium/src/out/Release/Chromium.app/Contents/MacOS/Chromium".freeze
#	@chrome_dir = "/Users/atotic/chromium/src/out/Release/Chromium.app".freeze
	@chrome_binary = File.join(@pb_chrome_dir, "bin/mac/Chromium.app/Contents/MacOS/Chromium").freeze
	@chrome_dir = File.join(@pb_chrome_dir, "bin/mac//Chromium.app").freeze
	@chrome_profile_dir = File.join(@pb_chrome_dir, 'chromium_profile')
	@pdf_toolkit_binary = "/usr/local/bin/pdftk".freeze
	@convert_binary = "/usr/local/bin/convert".freeze
	@graphicsmagick_binary = "/usr/local/bin/gm".freeze
	#
	@comet_port = 28000
	@comet_host = "localhost"

	class << self
		attr_accessor :root_dir,:data_dir, :tmp_dir, :log_dir, :test_dir
		attr_accessor :environment
		attr_accessor :book_templates_dir, :photo_dir, :book2pdf_dir
		attr_accessor :chrome_binary, :chrome_dir, :chrome_profile_dir, :pdf_toolkit_binary
		attr_accessor :convert_binary, :graphicsmagick_binary
		attr_accessor :comet_port, :comet_host
	end
	
	def self.init()
		Dir.mkdir(@data_dir) unless File.exists?(@data_dir)
		Dir.mkdir(@tmp_dir) unless File.exist?(@tmp_dir)
		Dir.mkdir(@log_dir) unless File.exists?(@log_dir)
		Dir.mkdir(@photo_dir) unless File.exists?(@photo_dir)
		Dir.mkdir(@book2pdf_dir) unless File.exists?(@book2pdf_dir)
	end

	def self.development?
		@environment == :development
	end

	def self.production?
		@environment == :production
	end
end

SvegSettings.init()

if SvegSettings.development?
	require 'backports'
	require_relative 'debug'
end