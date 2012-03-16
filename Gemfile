source :rubygems

gem 'rake'

gem "sinatra"
gem "thin" # thin for async responses
gem 'rack' # because of https://github.com/nakajima/rack-flash/issues/8
gem 'rack-flash', :git => "git://github.com/ChrisCauser/rack-flash.git"

gem "sequel"
gem "mysql2"

gem 'json'
gem 'log4r'
gem 'nokogiri' # html parsing
gem 'css_parser'

gem 'delayed_job', "~> 3.0"
gem 'delayed_job_sequel', :git => "git://github.com/atotic/delayed_job_sequel.git"
gem 'daemons'

group :development do
	gem "ruby-debug"
	gem "wkpdf"
	gem "growl"
end

group :test do
  gem "sfl" # spawn on ruby 1.8.7
  gem "rack-test"
end