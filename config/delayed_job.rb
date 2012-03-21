require_relative 'settings'
require_relative 'db'
require 'delayed_job_sequel'
require 'log4r'

raise "Already defined" if Object.const_defined?("RAILS_DEFAULT_LOGGER")
Object.const_set("RAILS_DEFAULT_LOGGER", Log4r::Logger.new('delayed_job_logger'))
Delayed::Worker.destroy_failed_jobs = false

