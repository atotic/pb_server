#!/bin/sh
# Initialize script for thin daemons
### BEGIN INIT INFO
# Provides:          delayed_job
# Required-Start:    $local_fs $remote_fs $network
# Required-Stop:     $local_fs $remote_fs
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: delayed_job initscript
# Description:       delayed_job part of the pb4us server family
### END INIT INFO
# prototypical init script
# Do NOT "set -e"

export RACK_ENV=production
DAEMON=$job_bin

case "$1" in
  start)
	$DAEMON start
	;;
  stop)
	$DAEMON stop
	;;
  restart)
	$DAEMON restart
	;;
  *)
	echo "Usage: $0 {start|stop|restart}" >&2
	exit 3
	;;
esac
