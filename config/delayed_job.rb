require 'config/settings'

require 'log4r'
require 'delayed_job_data_mapper'

Object.const_set("RAILS_DEFAULT_LOGGER", Log4r::Logger.new('delayed_job_logger'))
Delayed::Worker.destroy_failed_jobs = false

