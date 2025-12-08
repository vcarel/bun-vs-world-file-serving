# Generate ETag using Nginx algorithm: "{mtime-hex}-{size-hex}"
def generate_etag(mtime, size)
  mtime_hex = mtime.to_i.to_s(16)
  size_hex = size.to_s(16)
  "\"#{mtime_hex}-#{size_hex}\""
end

# Metadata cache only (not file contents)
$metadata_cache = {}

def get_metadata(path)
  unless $metadata_cache[path]
    file_path = File.join('dist', path)
    stat = File.stat(file_path)

    # MIME type mapping
    ext = File.extname(path).downcase
    mime_types = {
      '.html' => 'text/html',
      '.js' => 'application/javascript',
      '.css' => 'text/css',
      '.json' => 'application/json',
      '.png' => 'image/png',
      '.jpg' => 'image/jpeg',
      '.jpeg' => 'image/jpeg',
      '.gif' => 'image/gif',
      '.svg' => 'image/svg+xml',
      '.ico' => 'image/x-icon',
      '.woff' => 'font/woff',
      '.woff2' => 'font/woff2',
      '.ttf' => 'font/ttf',
      '.eot' => 'application/vnd.ms-fontobject'
    }

    $metadata_cache[path] = {
      type: mime_types[ext] || 'application/octet-stream',
      etag: generate_etag(stat.mtime.to_f, stat.size)
    }
  end
  $metadata_cache[path]
end

# Rack application for pre-compressed gzip serving from disk
app = lambda do |env|
  path = env['PATH_INFO']
  path = '/index.html' if path == '/'

  file_path = File.join('dist', path)

  # Check if file exists
  unless File.exist?(file_path)
    return [404, { 'Content-Type' => 'text/plain' }, ['Not Found']]
  end

  metadata = get_metadata(path)
  accept_encoding = env['HTTP_ACCEPT_ENCODING'] || ''

  # Serve pre-compressed .gz file if client accepts gzip
  if accept_encoding.include?('gzip')
    gz_path = "#{file_path}.gz"

    if File.exist?(gz_path)
      gz_stat = File.stat(gz_path)

      headers = {
        'Content-Encoding' => 'gzip',
        'Content-Type' => metadata[:type],
        'Content-Length' => gz_stat.size.to_s,
        'Cache-Control' => 'public, max-age=0, must-revalidate',
        'ETag' => metadata[:etag],
        'Vary' => 'Accept-Encoding'
      }

      body = File.binread(gz_path)
      return [200, headers, [body]]
    end
  end

  # Fallback to uncompressed file
  stat = File.stat(file_path)
  headers = {
    'Content-Type' => metadata[:type],
    'Content-Length' => stat.size.to_s,
    'Cache-Control' => 'public, max-age=0, must-revalidate',
    'ETag' => metadata[:etag]
  }

  body = File.binread(file_path)
  [200, headers, [body]]
end

run app
