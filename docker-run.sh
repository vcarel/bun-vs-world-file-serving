#!/bin/bash

# Helper script to run Nginx Docker containers with volume mounts

DIST_DIR="$(pwd)/dist"

case "$1" in
  basic)
    docker run -d --name perf-test -p 3000:3000 -v "$DIST_DIR:/var/www/html:ro" nginx-basic
    ;;
  gzip)
    docker run -d --name perf-test -p 3000:3000 -v "$DIST_DIR:/var/www/html:ro" nginx-gzip
    ;;
  cache)
    docker run -d --name perf-test -p 3000:3000 -v "$DIST_DIR:/var/www/html:ro" nginx-cache
    ;;
  full)
    docker run -d --name perf-test -p 3000:3000 -v "$DIST_DIR:/var/www/html:ro" nginx-full
    ;;
  stop)
    docker stop perf-test 2>/dev/null
    docker rm perf-test 2>/dev/null
    ;;
  *)
    echo "Usage: $0 {basic|gzip|cache|full|stop}"
    exit 1
    ;;
esac
