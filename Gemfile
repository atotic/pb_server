source :rubygems

gem 'rake'

gem "sinatra"
gem "thin"
gem 'rack' 
gem 'rack-flash3' # because of https://github.com/nakajima/rack-flash/issues/8

gem "sequel"
gem "mysql2"

gem 'json'
gem 'log4r'
gem 'nokogiri' # html parsing
gem 'css_parser'

gem 'delayed_job', "~> 3.0" # :git => "git://github.com/atotic/delayed_job.git"
gem 'delayed_job_sequel', :git => "git://github.com/atotic/delayed_job_sequel.git"
#gem 'delayed_job_sequel', :path => "../../delayed_job_sequel"
gem 'daemons'
gem 'pony' # email
gem 'omniauth-facebook'
gem 'omniauth-google-oauth2'

group :development do
	gem "ruby-debug", :platforms => :ruby_18
	gem "ruby-debug-base19", "0.11.26", :platforms => :ruby_19
	gem "ruby-debug19", "0.11.6", :require => 'ruby-debug', :platforms => :ruby_19
	gem "linecache19", "0.5.13"
	gem "growl"
end

group :test do
  gem "rack-test"
end
