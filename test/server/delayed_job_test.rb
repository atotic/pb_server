# bin/rake test:server TEST=test/server/delayed_job_test.rb

require 'test/unit'
require "rack/test"
require 'config/settings'
require 'config/db'
require 'svegutils'
require "log4r"
require 'app/book2pdf_job'


# Exercises http API for pdf_saver_server.rb

class DelayedJobTest < Test::Unit::TestCase
	LOGGER = Log4r::Logger.new 'delayed_job_test'
	LOGGER.add Log4r::Outputter.stdout

	def setup
		Delayed::Backend::Sequel::Job.delete
		assert SvegSettings.environment == :development, "Server tests must be run in development mode"
	end
	
	def teardown
		`./script/delayed_job stop`
	end

	def test_simple_job
		assert Delayed::Backend::Sequel::Job.count == 0, "Have no jobs"
		10.times { Delayed::Job.enqueue PB::TestJob.new("test_simple_job") }
		assert Delayed::Backend::Sequel::Job.count == 10, "Need 10 jobs"
		`./script/delayed_job start`
		begin
			Timeout.timeout(10) do
				Kernel.sleep(0.1) while Delayed::Backend::Sequel::Job.count != 0
			end
		rescue Timeout::Error => e
			assert Delayed::Backend::Sequel::Job.count == 0, "Jobs not completed in 10 seconds, #{Delayed::Backend::Sequel::Job.count} jobs remaining."
		end
	end
	
end
