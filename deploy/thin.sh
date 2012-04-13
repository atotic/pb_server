#!/bin/sh
### BEGIN INIT INFO
# Provides:          thin
# Required-Start:    $local_fs $remote_fs
# Required-Stop:     $local_fs $remote_fs
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: thin initscript
# Description:       thin
### END INIT INFO

# Original author: Forrest Robertson

# Do NOT "set -e"

DAEMON=/usr/local/rvm/bin/bootup_thin
SCRIPT_NAME=/etc/init.d/thin
CONFIG_PATH=/etc/thin

case "$1" in
  start)
	$DAEMON start --all $CONFIG_PATH
	;;
  stop)
	$DAEMON stop --all $CONFIG_PATH
	;;
  restart)
	$DAEMON restart --all $CONFIG_PATH
	;;
  *)
	echo "Usage: $SCRIPT_NAME {start|stop|restart}" >&2
	exit 3
	;;
esac

:
