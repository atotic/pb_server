# gem requires
require 'config/settings'
#require 'dm-core'
#require 'dm-validations'
#require 'dm-migrations'
#require 'dm-transactions'
#require 'dm-aggregates'
#require 'data_objects'

require 'data_mapper'
require "benchmark"

DataMapper::Property::String.length(128) # must be declared before model definition
DataMapper::Model.raise_on_save_failure = true
#  	if ($0.match(/script\/(delayed_job)/)) then
  DataMapper::Logger.new(File.join(SvegSettings.log_dir, "datamapper.log"), :debug)
#	  end
#database_url ="sqlite3://localhost/#{SvegSettings.data_dir}#{SvegSettings.environment}.sqlite3"
database_url ="mysql://sveg:svegsveg@localhost/sveg_#{SvegSettings.environment}"
puts Benchmark.measure { adapter = DataMapper.setup(:default, database_url) }
puts "adapter done"
# i would love to set busy timeout, but it is impossible with DataMapper.
# datamapper uses data_objects uses do_sqlite3, which is a binary extension that provides no facilities for busy_timeout
# sqlite3_busy_timeout( db, 100 );
# instead, patch dataobjects to retry updates on failure