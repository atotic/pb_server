# gem requires
require 'config/settings'

#require 'dm-core'
#require 'dm-validations'
#require 'dm-migrations'
#require 'dm-transactions'
#require 'dm-aggregates'
#require 'data_objects'

require 'data_mapper'

DataMapper::Property::String.length(128) # must be declared before model definition
DataMapper::Model.raise_on_save_failure = true
#  	if ($0.match(/script\/(delayed_job)/)) then
  DataMapper::Logger.new(File.join(SvegSettings.log_dir, "datamapper.log"), :debug)
#	  end
database_url ="sqlite3://#{SvegSettings.data_dir}/#{SvegSettings.environment}.sqlite"
adapter = DataMapper.setup(:default, database_url)
