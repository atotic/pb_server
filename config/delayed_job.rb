require 'config/settings'
require 'config/db'
require 'delayed_job_sequel'
require 'log4r'

Object.const_set("RAILS_DEFAULT_LOGGER", Log4r::Logger.new('delayed_job_logger'))
Delayed::Worker.destroy_failed_jobs = false

