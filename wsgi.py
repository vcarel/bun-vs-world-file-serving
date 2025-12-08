import os
import mimetypes
from pathlib import Path

# Generate ETag using Nginx algorithm: "{mtime-hex}-{size-hex}"
def generate_etag(mtime, size):
    mtime_hex = hex(int(mtime))[2:]
    size_hex = hex(size)[2:]
    return f'"{mtime_hex}-{size_hex}"'

# Metadata cache only (not file contents)
metadata_cache = {}

def get_metadata(path):
    if path not in metadata_cache:
        file_path = Path("dist") / path.lstrip("/")
        stat = file_path.stat()
        content_type, _ = mimetypes.guess_type(str(file_path))
        metadata_cache[path] = {
            "type": content_type or "application/octet-stream",
            "etag": generate_etag(stat.st_mtime, stat.st_size),
        }
    return metadata_cache[path]

def application(environ, start_response):
    """WSGI application for pre-compressed gzip serving from disk"""
    path = environ['PATH_INFO']
    path = '/index.html' if path == '/' else path

    file_path = Path("dist") / path.lstrip("/")

    # Check if file exists
    if not file_path.exists():
        start_response('404 Not Found', [('Content-Type', 'text/plain')])
        return [b'Not Found']

    metadata = get_metadata(path)
    accept_encoding = environ.get('HTTP_ACCEPT_ENCODING', '')

    # Serve pre-compressed .gz file if client accepts gzip
    if 'gzip' in accept_encoding:
        gz_path = Path(str(file_path) + ".gz")

        if gz_path.exists():
            gz_stat = gz_path.stat()

            headers = [
                ('Content-Encoding', 'gzip'),
                ('Content-Type', metadata["type"]),
                ('Content-Length', str(gz_stat.st_size)),
                ('Cache-Control', 'public, max-age=0, must-revalidate'),
                ('ETag', metadata["etag"]),
                ('Vary', 'Accept-Encoding'),
            ]

            start_response('200 OK', headers)
            with open(gz_path, 'rb') as f:
                return [f.read()]

    # Fallback to uncompressed file
    stat = file_path.stat()
    headers = [
        ('Content-Type', metadata["type"]),
        ('Content-Length', str(stat.st_size)),
        ('Cache-Control', 'public, max-age=0, must-revalidate'),
        ('ETag', metadata["etag"]),
    ]

    start_response('200 OK', headers)
    with open(file_path, 'rb') as f:
        return [f.read()]
