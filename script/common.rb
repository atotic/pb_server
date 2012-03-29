# common server startup routines

def usage
	unless ARGV.length >= 1 && ARGV[0].match(/start|stop|restart|debug|dump_conf/)
		puts "invalid option #{ARGV[0]}"
		$stdout.puts "usage: #{__FILE__} start|stop|restart|debug|dump_conf [thin options]"
		exit
	end
end

def get_cmd_line(options)
	cmd_line = [ 
		"bin/thin",
		ARGV[0]
	]
	[:port, :rackup, :pid,:log,:tag, :timeout].each do |o|
		cmd_line.push("--#{o.to_s} #{options[o]}") if options.has_key? o
	end
	[:daemonize, :debug, :force].each do |o|
		cmd_line.push("--#{o.to_s}") if options.has_key? o
	end
#	puts cmd_line.join(' ')
	cmd_line.join(' ')
end

def process(options)
	if (ARGV[0].eql? 'debug') then
		require_relative '../config/debug'
		ARGV[0] = 'start'
		options[:debug] = true
	else
		options[:daemonize] = true
	end

	usage

	if (ARGV[0].eql? 'dump_conf')
		utf_options = {}	# convert to utf8 for clean utf8 encoding
		options.each_pair { |k,v| utf_options[k] = ((v.is_a? String) ? v.force_encoding("UTF-8") : v)}
		puts utf_options.to_yaml
	else
		cmd_line = get_cmd_line(options)
		if options[:debug]
			Kernel.exec cmd_line
		else
			out = `#{cmd_line} 2>&1`
			puts out unless out.empty?
			puts "Error " unless $?.success?
		end
	end
end