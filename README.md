# Bun vs Nginx Performance Benchmark

A comprehensive performance comparison between **Bun**, **Node.js**, **Python**, **Ruby**, and **Nginx** static file servers, testing pre-compressed gzip vs on-the-fly compression strategies.

## Purpose

This benchmark compares the throughput and latency of different server configurations:

- **Bun** vs **Node.js** vs **Python** vs **Ruby** vs **Nginx** static file serving
- **Pre-compressed gzip files** vs **on-the-fly gzip compression**
- With and without **memory caching** (Bun only)
- Using **[Bombardier](https://github.com/codesenberg/bombardier)** as the HTTP benchmarking tool

The goal is to measure maximum requests per second, average latency, and throughput under high concurrency.

## Hardware Requirements

⚠️ **This benchmark requires at least 8 CPU cores:**
- **2 cores** for the tested server (pinned using `taskset`)
- **6+ cores** for Bombardier (benchmark tool)

If you have different hardware, adjust the configuration in `benchmark.ts`:

```typescript
// Adjust these constants based on your system:
const CONNECTIONS = "50";  // Parallel requests
const GOMAXPROCS = "6";     // Bombardier CPU cores (6-8 recommended)
const WORKERS = "2";        // Server worker processes

// And update taskset CPU pinning:
const tasksetCmd = ["taskset", "-c", "0-1", ...command.split(" ")]; // Adjust core range
```

## Prerequisites

- [Bun](https://bun.sh) (v1.3.2+)
- [Node.js](https://nodejs.org/) (v22.12.0+)
- [Python](https://www.python.org/) (v3.13+)
- [Ruby](https://www.ruby-lang.org/) (v3.3+)
- [Docker](https://www.docker.com/) (for Nginx containers)
- [Bombardier](https://github.com/codesenberg/bombardier) HTTP benchmarking tool

### Using mise (Recommended)

Install runtime versions using [mise](https://mise.jdx.dev/):

```bash
mise install
```

This will install Node.js, Python, and Ruby versions from [.tool-versions](.tool-versions).

Note: mise is compatible with asdf's `.tool-versions` format, so `asdf install` also works.

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

## Running the Benchmark

Run all benchmarks (Bun, Node.js, Python, Ruby, and Nginx configurations):

```bash
bun benchmark.ts
```

This will:
1. Build Docker images for Nginx configurations
2. Run benchmarks for 8 different server configurations (3 Bun + 1 Node.js + 1 Python + 1 Ruby + 2 Nginx)
3. Generate `benchmark-results.json` with detailed results
4. Display a summary table sorted by requests/second

### Running Individual Servers

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

## Benchmark Results

```
========================================
  BENCHMARK RESULTS SUMMARY
========================================

Rank | Server                              | Reqs/sec    | Avg Latency | Throughput
-----+-------------------------------------+-------------+-------------+-----------
   1 | Bun Precompressed Gzip              |    72433.09 |     16.45ms | 8.08GB/s
   2 | Nginx Precompressed Gzip            |    65906.14 |     28.74ms | 7.36GB/s
   3 | Bun Precompressed Gzip Memory Cache |    55431.30 |      0.90ms | 6.18GB/s
   4 | Ruby Precompressed Gzip             |    18859.19 |      2.75ms | 1.94GB/s
   5 | Node.js Precompressed Gzip          |    15512.30 |      3.22ms | 1.73GB/s
   6 | Python Precompressed Gzip           |    15329.50 |      3.26ms | 1.71GB/s
   7 | Bun On-The-Fly Gzip                 |      374.99 |    132.46ms | 42.83MB/s
   8 | Nginx On-The-Fly Gzip               |      227.14 |    217.75ms | 25.82MB/s
```

## Key Findings

- **Bun outperforms Nginx by ~10%** (72.4k vs 65.9k req/s) for pre-compressed gzip files, achieving 8.08 GB/s throughput
- **Bun.file optimizations are more effective than explicit memory caching** - direct file serving is 31% faster than in-memory caching (72.4k vs 55.4k req/s)
- **Ruby, Node.js, and Python show similar performance** (15-19k req/s), with **Ruby/Puma being the fastest** of the three interpreted languages at 18.9k req/s
- **Never use on-the-fly gzip compression in production** - it's 193-319x slower than pre-compressed files (227-375 req/s vs 66-72k req/s), creating a severe CPU bottleneck

## License

MIT