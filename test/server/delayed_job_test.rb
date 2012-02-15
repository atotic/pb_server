# bin/rake test:server TEST=test/server/delayed_job_test.rb

require 'test/unit'
require "rack/test"
require 'config/settings'
require 'config/db'
require 'svegutils'
require "log4r"
require 'app/book2pdf_job'



DataMapper.finalize
# Exercises http API for pdf_saver_server.rb

class DelayedJobTest < Test::Unit::TestCase
  LOGGER = Log4r::Logger.new 'delayed_job_test'
  LOGGER.add Log4r::Outputter.stdout

  def setup
    Delayed::Backend::DataMapper::Job.destroy
    assert SvegSettings.environment == :development, "Server tests must be run in development mode"
  end
  
  def teardown
    `./script/delayed_job stop`
  end

  def test_simple_job
    jobs = Delayed::Backend::DataMapper::Job.count
    assert Delayed::Backend::DataMapper::Job.count == 0, "Have no jobs"
    10.times { Delayed::Job.enqueue PB::TestJob.new("test_simple_job") }
    assert Delayed::Backend::DataMapper::Job.count == 10, "Need 10 jobs"
    `./script/delayed_job start`
    Kernel.sleep(1)
    assert Delayed::Backend::DataMapper::Job.count == 0, "Soft fail, generaly 0 but now #{Delayed::Backend::DataMapper::Job.count} jobs remaining"
  end
  
end
