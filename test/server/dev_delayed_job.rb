# bin/rake test:all TEST=test/dev_delayed_job.rb

#require 'ruby-debug'
#Debugger.settings[:autoeval] = true

OLD_RACK_ENV = ENV['RACK_ENV']
ENV['RACK_ENV'] = "development"

require 'test/unit'
require "rack/test"
require 'config/settings'
require 'config/db'
require 'svegutils'
require "log4r"
require 'app/book2pdf_job'

LOGGER = Log4r::Logger.new 'chrome_saver_test'
LOGGER.add Log4r::Outputter.stdout

DataMapper.finalize
# Exercises http API for pdf_saver_server.rb

class DelayedJobTest < Test::Unit::TestCase

  def setup
    (assert false, "chrome_saver must be run in development environment") if OLD_RACK_ENV && OLD_RACK_ENV != 'development'
#    `./script/delayed_job start`
  end
  
  def teardown
    
  end

  def test_simple_job
    jobs = Delayed::Backend::DataMapper::Job.count
    puts "Starting with #{jobs}"
    10.times { Delayed::Job.enqueue PB::TestJob.new("test_simple_job") }
    puts "Now have #{jobs}"
    Kernel.sleep(1)
    puts "After sleeping have #{jobs}"
  end
  
end
