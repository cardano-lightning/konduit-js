#!/usr/bin/env bash

export SVG_FILE=./design/icons/konduit.svg

inkscape -w 16 -h 16 -o /tmp/16.png "$SVG_FILE"
inkscape -w 32 -h 32 -o /tmp/32.png "$SVG_FILE"
inkscape -w 48 -h 48 -o /tmp/48.png "$SVG_FILE"

convert /tmp/16.png /tmp/32.png /tmp/48.png ./public/favicon.ico
