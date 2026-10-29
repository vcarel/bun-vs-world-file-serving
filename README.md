# Bun vs Nginx vs Node.js vs Python vs Ruby performance benchmark

A comprehensive performance comparison between **Bun**, **Node.js**, **Python**, **Ruby**, and **Nginx** static file servers, testing pre-compressed gzip vs on-the-fly compression strategies.

## Purpose

This benchmark compares the throughput and latency of different server configurations:

- **Bun** vs **Node.js** vs **Python** vs **Ruby** vs **Nginx** static file serving
- **Pre-compressed gzip files** vs **on-the-fly gzip compression**
- With and without **memory caching** (Bun only)
- Using **[Bombardier](https://github.com/codesenberg/bombardier)** as the HTTP benchmarking tool

The goal is to measure maximum requests per second, average latency, and throughput under high concurrency.

## Hardware requirements

⚠️ **This benchmark requires at least 8 CPU cores:**
- **2 cores** for the tested server (pinned using `taskset`)
- **6+ cores** for Bombardier (benchmark tool)

If you have different hardware, adjust the configuration in `benchmark.ts`:

```typescript
// Adjust these constants based on your system:
const CONNECTIONS = "50"; // Parallel requests
const GOMAXPROCS = "6"; // Bombardier CPU cores (6-8 recommended)
const WORKERS = "2"; // Server worker processes
const SERVER_CPUS = "0,1"; // CPUs the tested server is pinned to
```

## Prerequisites

- [mise](https://mise.jdx.dev/): run `mise install` to get Bun, Node.js, Python, Ruby and Bombardier at the versions pinned in [.tool-versions](.tool-versions)
- [Docker](https://www.docker.com/) (for Nginx containers, version pinned in the Dockerfiles)

## Installation

Clone the repository and install dependencies:

```bash
# Install Bun dependencies
bun install

# Install Python dependencies (Gunicorn + gevent)
pip install -r requirements.txt

# Install Ruby dependencies (Puma, Rack)
bundle install
```

## Running the benchmark

Run all benchmarks (Bun, Node.js, Python, Ruby, and Nginx configurations):

```bash
bun benchmark.ts
```

The Docker daemon must be running. All servers listen on port 9000, which must be free.

This will:
1. Build Docker images for Nginx configurations
2. Run benchmarks for 8 different server configurations (3 Bun + 1 Node.js + 1 Python + 1 Ruby + 2 Nginx)
3. Generate `benchmark-results.json` with detailed results
4. Display a summary table sorted by requests/second

### Running individual servers

You can also run individual servers for testing:

```bash
# Build the project first
bun run build

# Bun servers
bun run start:precompressed-gzip
bun run start:precompressed-gzip-memory-cache
bun run start:on-the-fly-gzip

# Node.js server
bun run start:node

# Python server
bun run start:python

# Ruby server
bun run start:ruby
```

## Benchmark results

Run on October 29, 2026, on an AMD Ryzen AI 7 350 (16 threads, 30 GB RAM), Linux 7.2 (btrfs), with Bun 1.4.4, Node.js 26.12.1, Python 3.15.2 (Gunicorn 26.2 + gevent 26.9), Ruby 4.0.9 (Puma 8.0) and Nginx 1.31.8.

```
========================================
  BENCHMARK RESULTS SUMMARY
========================================

Rank | Server                              | Reqs/sec    | Avg Latency | Throughput
-----+-------------------------------------+-------------+-------------+-----------
   1 | Nginx precompressed gzip            |    96615.93 |      0.52ms | 11.89GB/s
   2 | Bun precompressed gzip memory cache |    76113.43 |      0.66ms | 9.35GB/s
   3 | Bun precompressed gzip              |    17332.89 |      2.88ms | 2.13GB/s
   4 | Ruby precompressed gzip             |    13528.08 |      3.69ms | 1.66GB/s
   5 | Node.js precompressed gzip          |    11548.62 |      4.33ms | 1.42GB/s
   6 | Python precompressed gzip           |    10447.58 |      4.78ms | 1.28GB/s
   7 | Bun on-the-fly gzip                 |      370.02 |    134.65ms | 46.00MB/s
   8 | Nginx on-the-fly gzip               |      151.92 |    326.84ms | 18.87MB/s
```

## Key findings

- **Nginx is the fastest for pre-compressed gzip files** (96.6k req/s, 11.9 GB/s), followed by **Bun's memory cache** (76.1k req/s, ~21% slower)
- **Bun reading files from disk is about 4x slower than Bun serving from memory** on this machine (17.3k vs 76.1k req/s). This is a regression in Bun 1.3.13: since that version, Bun only uses `sendfile` for files of 1 MiB or more. Our 131 KB file is now read into memory and copied back to the socket on every request, which halves throughput (about 39k req/s with Bun 1.3.12, 16-24k with 1.3.13 and later)
- **Ruby/Puma is the fastest of Ruby, Node.js, and Python** (13.5k req/s), ahead of Node.js (11.5k) and Python (10.4k)
- **Never use on-the-fly gzip compression in production** - it's 47-636x slower than pre-compressed files (152-370 req/s vs 17-97k req/s), creating a severe CPU bottleneck

## License

MIT
