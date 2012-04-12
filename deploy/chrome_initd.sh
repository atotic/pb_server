#!/bin/sh
### BEGIN INIT INFO
# Provides:          chrome_xvfb
# Required-Start:    $local_fs $remote_fs $network $xvfb
# Required-Stop:     $local_fs $remote_fs
# Default-Start:     2 3 4 5
# Default-Stop:      S 0 1 6
# Short-Description: chrome runs inside xvfb
# Description:       chromium_xvfb part of the pb4us server family
### END INIT INFO

set -e

# Must be a valid filename
NAME=chrome_xvfb
PIDFILE=/var/run/$NAME.pid
#This is the command to be run, give the full pathname
DAEMON=$chrome_binary
DAEMON_OPTS=$chrome_options
USER=deploy

export PATH="${PATH:+$PATH:}/usr/sbin:/sbin"

case "$1" in
  start)
        echo -n "Starting daemon: "$NAME
	start-stop-daemon --start --quiet --pidfile $PIDFILE --chuid $USER --exec $DAEMON -- $DAEMON_OPTS
        echo "."
	;;
  stop)
        echo -n "Stopping daemon: "$NAME
	start-stop-daemon --stop --quiet --oknodo --pidfile $PIDFILE
        echo "."
	;;
  restart)
        echo -n "Restarting daemon: "$NAME
	start-stop-daemon --stop --quiet --oknodo --retry 30 --pidfile $PIDFILE
	start-stop-daemon --start --quiet --pidfile $PIDFILE --chuid $USER --exec $DAEMON -- $DAEMON_OPTS
	echo "."
	;;

  *)
	echo "Usage: "$1" {start|stop|restart}"
	exit 1
esac

exit 0