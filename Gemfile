source :rubygems

gem 'rake'
gem "sinatra"
gem "datamapper"
gem 'json'
gem "thin" # thin for async responses
gem 'rack', "<1.4" # because of https://github.com/nakajima/rack-flash/issues/8
gem 'rack-flash'
gem 'nokogiri' # html parsing
gem 'css_parser'
gem 'log4r'
# delayed job
gem 'delayed_job'
gem 'delayed_job_data_mapper', :git => "git://github.com/collectiveidea/delayed_job_data_mapper.git"
gem 'daemons'

group :development do
	gem "ruby-debug"
	gem 'sinatra-reloader'
	gem "dm-mysql-adapter"
	gem "wkpdf"
	gem "growl"
end

group :test do
  gem "sfl" # spawn on ruby 1.8.7
  gem "rack-test"
end