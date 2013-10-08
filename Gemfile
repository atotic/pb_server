source 'https://rubygems.org'

gem 'rake'

gem "sinatra"
gem "thin"
gem 'rack', :git => "https://github.com/atotic/rack", :branch => 'rack-1.5'
gem 'rack-flash3' # because of https://github.com/nakajima/rack-flash/issues/8

gem "sequel" # database
gem "pg"

gem 'json'
gem 'log4r'
gem 'nokogiri' # html parsing
gem 'css_parser'
gem 'less'
gem 'therubyracer'
gem 'filesize'

gem 'delayed_job', "~> 3.0" # :git => "git://github.com/atotic/delayed_job.git"
gem 'delayed_job_sequel', :git => "https://github.com/atotic/delayed_job_sequel"
#gem 'delayed_job_sequel', :path => "../../delayed_job_sequel"
gem 'daemons'
gem 'pony' # email
gem 'omniauth-facebook'
gem 'omniauth-google-oauth2'
gem 'em-http-request'

# http://blog.wyeworks.com/2011/11/1/ruby-1-9-3-and-ruby-debug/
group :development do
	gem "byebug"
	gem "growl"
end

group :test do
  gem "rack-test"
end
