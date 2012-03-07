require 'config/settings'

require 'log4r'
require 'config/db'
require 'delayed_job_sequel'

Object.const_set("RAILS_DEFAULT_LOGGER", Log4r::Logger.new('delayed_job_logger'))
Delayed::Worker.destroy_failed_jobs = false

