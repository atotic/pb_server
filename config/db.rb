# gem requires
require 'active_support/inflector' # see https://code.google.com/p/ruby-sequel/issues/detail?id=329
require 'sequel'
require 'logger'

Sequel::Model.raise_on_save_failure = true
options = {}
#options[:logger] = Logger.new(STDOUT) if SvegSettings.environment == :development
db_config = {
		:adapter => 'mysql2',
		:default_schema => 'public',
		:user => PB::Secrets::MYSQL_USER,
		:password => PB::Secrets::MYSQL_PW,
		:host => 'localhost',
		:database => "sveg_#{SvegSettings.environment}",
		:max_connections => 5
}
DB = Sequel.connect(db_config, options)
