# common server startup routines

def usage
	unless ARGV.length >= 1 && ARGV[0].match(/start|stop|restart|debug|dump_conf/)
		script_name = Kernel.caller[1].scan(/[^:]*/)[0]
		puts "invalid option #{ARGV[0]}"
		$stdout.puts "usage: #{script_name} start|stop|restart|debug|dump_conf [thin options]"
		exit
	end
end

def get_cmd_line(options)
	cmd_line = [ 
		"thin",
		ARGV[0]
	]
	[:port, :rackup, :pid, :log, :tag, :timeout, :environment, :user, :group].each do |o|
		cmd_line.push("--#{o.to_s} #{options[o]}") if options.has_key? o
	end
	[:daemonize, :debug, :force].each do |o|
		cmd_line.push("--#{o.to_s}") if options.has_key? o
	end
  cmd_line.push("--chdir '#{SvegSettings.root_dir}'")
#	puts cmd_line.join(' ')
	cmd_line.join(' ')
end

def process(options)

	# optional debug setup
	if (ARGV[0].eql? 'debug') then
		require_relative '../config/debug'
		ARGV[0] = 'start'
		options[:debug] = true
	else
		options[:daemonize] = true
	end

	# set up common options
	options = options.merge({ :environment => SvegSettings.environment.to_s})
	# options = options.merge({ :user => 'deploy', :group => 'deploy'}) if options[:environment].eql?('production')

	usage

	if (ARGV[0].eql? 'dump_conf')
		raise "Init scripts must run in production environment #{ENV['USER']}" unless SvegSettings.production?
		utf_options = {}	# convert to utf8 for clean utf8 encoding
		options.each_pair { |k,v| utf_options[k] = ((v.is_a? String) ? v.force_encoding("UTF-8") : v)}
		puts utf_options.to_yaml
	else
		cmd_line = get_cmd_line(options)
		if options[:debug]
			Kernel.exec get_cmd_line(options)
		else
			out = `#{cmd_line} 2>&1`.chomp
			puts "Error #{out}" unless $?.success?
		end
	end
end
