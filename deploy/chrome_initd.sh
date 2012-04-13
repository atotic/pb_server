#!/bin/sh
### BEGIN INIT INFO
# Provides:          chrome_daemon
# Required-Start:    $local_fs $remote_fs $network $xvfb
# Required-Stop:     $local_fs $remote_fs
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: chrome runs inside xvfb
# Description:       chrome_daemon part of the pb4us server family
### END INIT INFO
DAEMON=$chrome_daemon_bin

case "$1" in
  start)
	$DAEMON
	;;
  stop)
	$DAEMON --stop
	;;
  restart)
	$DAEMON --restart
	;;
  *)
	echo "Usage: $0 {start|stop|restart}" >&2
	exit 3
	;;
esac
