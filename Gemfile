source :rubygems

gem 'rake'

gem "sinatra"
gem "thin"
gem 'rack' # because of https://github.com/nakajima/rack-flash/issues/8
gem 'rack-flash3'

gem "sequel"
gem "mysql2"

gem 'json'
gem 'log4r'
gem 'nokogiri' # html parsing
gem 'css_parser'

gem 'delayed_job', "~> 3.0", :git => "git://github.com/atotic/delayed_job.git"
gem 'delayed_job_sequel', :git => "git://github.com/atotic/delayed_job_sequel.git"
gem 'daemons'

gem 'backports'

group :development do
	gem "ruby-debug", :platforms => :ruby_18
	gem "ruby-debug-base19", "0.11.26", :platforms => :ruby_19
	gem "ruby-debug19", "0.11.6", :require => 'ruby-debug', :platforms => :ruby_19
	gem "wkpdf"
	gem "growl"
end

group :test do
  gem "sfl" # spawn on ruby 1.8.7
  gem "rack-test"
end