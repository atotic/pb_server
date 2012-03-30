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
		"thin",
		ARGV[0]
	]
	[:port, :rackup, :pid,:log,:tag, :timeout, :environment, :user, :group].each do |o|
		cmd_line.push("--#{o.to_s} #{options[o]}") if options.has_key? o
	end
	[:daemonize, :debug, :force].each do |o|
		cmd_line.push("--#{o.to_s}") if options.has_key? o
	end
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
	options = options.merge({ :user => 'deploy', :group => 'deploy'}) if options[:environment].eql?('production')

	usage

	if (ARGV[0].eql? 'dump_conf')
		utf_options = {}	# convert to utf8 for clean utf8 encoding
		options.each_pair { |k,v| utf_options[k] = ((v.is_a? String) ? v.force_encoding("UTF-8") : v)}
		puts utf_options.to_yaml
	else
		cmd_line = get_cmd_line(options)
		if options[:debug]
			Kernel.exec get_cmd_line(options)
		else
			out = `#{cmd_line} 2>&1`
			puts out unless out.empty?
			puts "Error " unless $?.success?
		end
	end
end

def generate_init_script(server_name)
	thin_bin = `which thin`.chomp
	script = <<-eos
#!/bin/sh
### BEGIN INIT INFO
# Provides:          #{server_name}
# Required-Start:    $local_fs $remote_fs $network
# Required-Stop:     $local_fs $remote_fs
# Default-Start:     2 3 4 5
# Default-Stop:      S 0 1 6
# Short-Description: ${server_name} initscript
# Description:       #{server_name} part of the pb4us server family
### END INIT INFO

# Do NOT "set -e"

DAEMON=#{thin_bin}
SCRIPT_NAME=/etc/init.d/#{server_name}
CONFIG_PATH=/etc/thin/

# Exit if the package is not installed
[ -x "$DAEMON" ] || exit 0

case "$1" in
  start)
	$DAEMON start --all $CONFIG_PATH
	;;
  stop)
	$DAEMON stop --all $CONFIG_PATH
	;;
  restart)
	$DAEMON restart --all  $CONFIG_PATH
	;;
  *)
	echo "Usage: $SCRIPT_NAME {start|stop|restart}" >&2
	exit 3
	;;
esac
eos
	script
end