#!/usr/bin/python

import numpy as np
import getopt
import sys
import cv2
import json

help_message = "USAGE: pookioface.py [--display] [--out <out_file>] <img_file>"
def usage(msg):
	if msg:
		print msg
	print help_message
	exit(-1)

def draw_rects(img, rects, color):
    for x1, y1, x2, y2 in rects:
        cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)

args, img_file = getopt.getopt(sys.argv[1:], '', ['display', 'out='])

try:
	img_file = img_file[0]
except:
	usage("img_file missing");

img = cv2.imread(img_file, 0)

if img == None:
	usage("file not found:" + img_file)

cascade = cv2.CascadeClassifier("./haarcascade_frontalface_alt.xml")
nested = cv2.CascadeClassifier("./haarcascade_eye.xml")

img = cv2.equalizeHist(img)
num_rects = cascade.detectMultiScale(img, scaleFactor=1.3, minNeighbors=4, minSize=(30,30), flags = cv2.cv.CV_HAAR_SCALE_IMAGE)
rects = []
height,width = img.shape

if len(num_rects) != 0:
	num_rects[:,2:] += num_rects[:,:2]
	for x1,y1,x2,y2 in num_rects:
		rects.append({ 'top' : round( float(y1)/height, 3),
			'left' : round( float(x1)/width, 3),
			'bottom': round( float(y2)/height, 3),
			'right': round( float(x2)/width, 3)
			})

args = dict(args)

if '--display' in args:
	cv2.namedWindow("image", cv2.CV_WINDOW_AUTOSIZE);
	draw_rects(img, num_rects, (0, 255, 0))
	cv2.imshow("image", img);
	cv2.waitKey();

if '--out' in args:
	try:
		f = open(args['--out'], 'w')
		f.write(json.dumps(rects))
		f.close
	except:
		usage("unable to open json file " + args['--out'])
else:
	print json.dumps(rects)
