require 'config/settings'

class Rails 
  @root = SvegSettings.data_dir
  require 'log4r'
  @logger = Log4r::Logger.new 'delayed_job_logger'
  class << self
    attr_accessor :root, :logger
  end
end

Object.const_set "RAILS_DEFAULT_LOGGER", Rails.logger

require 'delayed_job_data_mapper'

# delayed_job initialization
Delayed::Worker.destroy_failed_jobs = false

