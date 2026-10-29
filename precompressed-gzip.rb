#!/usr/bin/env ruby

# Simple wrapper to run Puma with the config.ru file
workers = ENV['WORKERS']&.to_i || 2

puts "🚀 Ruby precompressed gzip Server running at http://localhost:9000 (Workers: #{workers})"

# Execute Puma with the proper configuration
exec("puma", "-b", "tcp://0.0.0.0:9000", "-w", workers.to_s, "-t", "0:5", "--preload", "-q")
