
# http://rake.rubyforge.org/
require 'bundler/setup'
require 'rubygems'
require 'rake'
require 'rake/testtask'

class Helpers
	def self.psql_exec(*sql)
		cmd_line = "#{SvegSettings.psql_binary} -h #{SvegSettings.postgres_host} -c \""
		cmd_line << sql.join(";")
		cmd_line << "\""

		success = Kernel.system cmd_line
		unless success
			puts "psql error: \n"
			puts cmd_line
			return false
		end
		return true
	end
	def self.psql_config
		{
			:adapter => 'postgres',
			:default_schema => 'public',
			:user => PB::Secrets::POSTGRES_USER,
			:password => PB::Secrets::POSTGRES_PW,
			:host => SvegSettings.postgres_host,
			:database => "pookio_#{SvegSettings.environment}",
			:max_connections => 5
		}
	end
end

task :default => ['test:all']

task :environment do
	require_relative 'config/settings'
	require 'sequel'
end

task :sudo do
	raise "This task must be run with rvmsudo" unless `whoami`.start_with?("root")
end

task :debug do
	require_relative 'config/debug'
end

namespace :test do
	ENV['TESTOPTS'] = '-v'
	desc "functional tests"
	Rake::TestTask.new("functional") do |t|
		t.pattern = 'test/*_test.rb'
		t.verbose = false
		t.warning = false
	end

	desc "server tests. defaults to development environment"
	Rake::TestTask.new("server") do |t|
		t.pattern = 'test/server/*_test.rb'
		t.verbose = false
		t.warning = false
	end

	desc "all tests, functional, server"
	task :all => [:'test:functional', :'test:server'] do |t|
		puts "All done"
	end
end

namespace :db do
	desc "creates  user"
	task :create_user  => :environment do
		db_name = "pookio_#{SvegSettings.environment}"
		success = Helpers::psql_exec(
			"CREATE USER #{PB::Secrets::POSTGRES_USER} WITH PASSWORD '#{PB::Secrets::POSTGRES_PW}'")
		puts "#{PB::Secrets::POSTGRES_USER} created" if success
	end

	desc "drops the database, creates empty one"
	task :drop_db => :environment do
		db_name = "pookio_#{SvegSettings.environment}"
		success = Helpers::psql_exec("DROP DATABASE IF EXISTS #{db_name}")
		success = Helpers::psql_exec("CREATE DATABASE #{db_name}" ) if success
		success = Helpers::psql_exec("GRANT ALL PRIVILEGES ON DATABASE #{db_name} TO #{PB::Secrets::POSTGRES_USER}") if success
	end

	desc "Migrates db schema"
	task :migrate => :environment do
		db_name = "pookio_#{SvegSettings.environment}"
		Sequel.extension :migration
		Sequel.connect( Helpers::psql_config ) do |db|
			::Sequel::Migrator.apply(db, File.join(SvegSettings.root_dir, 'db', 'migrate'))
		end
	end

	desc "Removes database, environment RACK_ENV=test|development|production"
	task :clean => [:environment, :debug] do
		x = "Y"
		if SvegSettings.environment == :production
			`stty raw -echo`
			$stdout.write "Remove #{SvegSettings.environment} database and data directory? [Yn]: "
			x = STDIN.getc.chr
			`stty -raw echo`
			puts x, "\n"
		end
		if x.match /[Yy]/
			`rm -fv #{SvegSettings.data_dir}/*`
			`rm -rfv #{SvegSettings.log_dir}/* #{SvegSettings.tmp_dir}/* #{SvegSettings.photo_dir}/* #{SvegSettings.book2pdf_dir}/*`
			Dir.mkdir(SvegSettings.data_dir) unless File.exists?(SvegSettings.data_dir)
			Rake::Task[:'db:drop_db'].execute
			Rake::Task[:'db:migrate'].execute
		end
	end

end

namespace :book_template do
	desc "Fills in book template with default page icons, image count, resized images, template_name can be *"
	task :fill, [:template_name] do |t, args|
		require_relative 'config/settings'
		require_relative 'config/db'
		require_relative 'lib/sveg_lib'
		args.with_defaults(:template_name => "*")
		if args.template_name.eql? "*" then
			PB::BookTemplate.all.each { |x| Rake::Task[:'book_template:fill'].execute(Rake::TaskArguments.new([:template_name], [x.name]))}
			Rake::Task[:'book_template:fill'].execute(Rake::TaskArguments.new([:template_name], ['common']))
		else
			puts args.template_name
			template = PB::BookTemplate.get(args.template_name)
			generate_icon_count = failed_icon_count = 0
			# generate page icons
			template.get_all_pages.each do |page|
				begin
					page.generate_icon_file
					generate_icon_count += 1
					puts "#{page.html_file_name}"
				rescue PB::MalformedHTML => ex #
					$stderr.puts "Could not generate icon for  #{page.html_file_name}"
					$stderr.puts ex.message
					failed_icon_count += 1
				rescue PB::FileExistsError => ex # exception thrown if file already exists
				end
			end
			puts "No page icons were generated for #{args.template_name}" if generate_icon_count == 0
			# asset images at different sizes
			template.multisize_image_assets
		end
	end

	desc "Reverts what book_template:fill did"
	task :clean, [:template_name] do |t, args|
		require_relative 'config/settings'
		require_relative 'config/db'
		require_relative 'lib/sveg_lib'
		if args.template_name.eql? "*" then
			PB::BookTemplate.all.each { |x| Rake::Task[:'book_template:clean'].execute(Rake::TaskArguments.new([:template_name], [x.name]))}
			Rake::Task[:'book_template:clean'].execute(Rake::TaskArguments.new([:template_name], ['common']))
			next
		end
		args.width_defaults(:template_name => false)
		abort "Error Template name not defined. User book_template:clean[template_name]" unless args.template_name
		template = PB::BookTemplate.get(args.template_name)
		pages = template.get_all_pages
		pages.each { |page| page.delete_icon_file }
		puts "#{args.template_name} icon files deleted"
		template.clean_image_assets
	end

end

namespace :jobs do
	desc "Clear the delayed_job queue."
	task :clear => :environment do
		x  = Delayed::Job.count
		Delayed::Job.delete_all
		puts "Deleted #{x} jobs in #{SvegSettings.environment}"
	end

	desc "Start a delayed_job worker."
	task :work => :environment do
		Delayed::Worker.new(:min_priority => ENV['MIN_PRIORITY'], :max_priority => ENV['MAX_PRIORITY'], :queues => (ENV['QUEUES'] || ENV['QUEUE'] || '').split(','), :quiet => false).start
	end
end

namespace :deploy  do
	desc "Deploys all init.d scripts"
	task :initd => [:'deploy:nginx', :'deploy:thin', :'deploy:delayed_job', :'deploy:chrome'] do
		puts 'initd scripts deployed. try rvmsudo RACK_ENV=production rake deploy:start'
	end

	desc "Compiles all the less files"
	task :less => :debug do
		Dir.entries("./public/less")\
			.select { |f| (f =~ /^(\.|mixin|bootstrap-variables)/).nil? }\
			.each do |f|
				puts f
				`lessc ./public/less/#{f} > ./public/css/#{f.sub(File.extname(f), '')}.css`
			end
	end

	desc "Removes init-d"
	task :remove_initd => [:sudo, :environment] do
		`update-rc.d -f delayed_job remove 1>&2`
		`update-rc.d -f thin remove 1>&2`
		`update-rc.d -f xvfb remove 1>&2`
		`update-rc.d -f chrome_daemon remove 1>&2`
		`rm -v /etc/init.d/thin 1>&2`
		`rm -v /etc/init.d/delayed_job 1>&2`
		`rm -v /etc/init.d/xvfb 1>&2`
		`rm -v /etc/init.d/chrome_daemon 1>&2`
	end

	desc "deploy delayed_job init.d"
	task :delayed_job => [:sudo, :environment] do
		full_path = File.expand_path('./script/delayed_job')
		`rvm wrapper ruby-1.9.3-p125 bootup #{full_path} 1>&2`
		puts 'created a wrapper for delayed_job'
		script_path = `which bootup_delayed_job`.chomp
		delay_init = IO.read('./deploy/delayed_job.sh')
		delay_init.gsub!(/\$job_bin/, script_path)
		File.open('/etc/init.d/delayed_job', 'w', 0755) { |f| f << delay_init }
		`update-rc.d delayed_job defaults 1>&2`
		puts 'created /etc/init.d/delayed_job'
	end

	desc "deploy thin init.d"
	task :thin => [:sudo, :environment] do
		`rvm wrapper ruby-1.9.3-p125 bootup thin 1>&2`
		`cp ./deploy/thin.sh /etc/init.d/thin`
		puts 'created /etc/init.d/thin'
		`RACK_ENV=production ./script/sveg dump_conf > /etc/thin/sveg.conf`
		puts 'created /etc/thin/sveg.conf'
		`RACK_ENV=production ./script/comet dump_conf > /etc/thin/comet.conf`
		puts 'created /etc/thin/comet.conf'
		`RACK_ENV=production ./script/pdf_saver_server dump_conf > /etc/thin/pdf_saver_server.conf`
		puts 'created /etc/thin/pdf_saver_server.conf'
		`update-rc.d thin defaults 1>&2`
	end

	desc "deploy nginx init.d"
	task :nginx => [:sudo, :environment] do
		user = {:mac => 'atotic staff', :linux => 'nginx nginx'}[SvegSettings.platform]
		port = "80"
		access_log = File.expand_path('nginx_access.log', SvegSettings.log_dir)
		error_log = File.expand_path('nginx_error.log', SvegSettings.log_dir)
		public_dir = File.expand_path('public', SvegSettings.root_dir)
		conf_text = IO.read('./deploy/nginx_template.conf')
		[:user, :access_log, :error_log, :public_dir, :port].each do |v|
			regex = Regexp.new("\\$#{v.to_s}")
			conf_text.gsub!(regex, eval(v.to_s))
		end
		conf_path = `nginx -V 2>&1`.match(/(--conf-path=)([\S]*)/)[2]
		File.open(conf_path, 'w', 0644) { |f| f << conf_text }
		puts "created #{conf_path}"
	end

	desc "deploy chrome init.d"
	task :chrome => [:sudo, :environment] do
		# two init scripts, one for xvfb, one for chrome
		`cp ./deploy/xvfb_initd.sh /etc/init.d/xvfb`
		`chmod 0755 /etc/init.d/xvfb`
		puts 'created /etc/init.d/xvfb'
		chrome_daemon_bin = SvegSettings.chrome_binary + "_daemon.sh"
		init_script = IO.read('./deploy/chrome_initd.sh')
		[:chrome_daemon_bin ].each do |v|
			regex = Regexp.new("\\$#{v.to_s}")
			init_script.gsub!(regex, eval(v.to_s))
		end
		File.open('/etc/init.d/chrome_daemon', 'w', 0755) {|f| f << init_script }
		puts 'created /etc/init.d/chrome_daemon'
		`update-rc.d xvfb defaults 1>&2`
		`update-rc.d chrome_daemon defaults 21 79 1>&2`
	end

	desc "start all servers"
	task :start => [:sudo, :environment] do
		`rvmsudo RACK_ENV=production /etc/init.d/thin start 1>&2`
		`rvmsudo RACK_ENV=production /etc/init.d/delayed_job start 1>&2`
		`sudo RACK_ENV=production /etc/init.d/xvfb start 1>&2`
		`sudo RACK_ENV=production /etc/init.d/chrome_daemon start 1>&2`
	end

	desc "stop all servers"
	task :stop => [:sudo, :environment] do
		`rvmsudo RACK_ENV=production /etc/init.d/thin stop 1>&2`
		`rvmsudo RACK_ENV=production /etc/init.d/delayed_job stop 1>&2`
		`sudo RACK_ENV=production /etc/init.d/chrome_daemon stop 1>&2`
		`sudo RACK_ENV=production /etc/init.d/xvfb stop 1>&2`
	end

end
