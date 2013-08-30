if RUBY_VERSION.to_f < 1.9
	require 'ruby-debug'
	Debugger.start
	Debugger.settings[:autoeval] = 1
	Debugger.settings[:autolist] = 1
else
	require 'byebug'
end
#puts "debugger on"
