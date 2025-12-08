#!/usr/bin/env python3

import os
import sys

# Simple wrapper to run Gunicorn with the wsgi.py file
workers = int(os.environ.get('WORKERS', '2'))

print(f"🚀 Python precompressed gzip Server running at http://localhost:3000 (Workers: {workers})")

# Execute Gunicorn with gevent workers for async I/O
os.execvp('gunicorn', [
    'gunicorn',
    '--bind', '0.0.0.0:3000',
    '--workers', str(workers),
    '--worker-class', 'gevent',
    '--worker-connections', '1000',
    '--preload',
    '--log-level', 'error',
    'wsgi:application'
])
