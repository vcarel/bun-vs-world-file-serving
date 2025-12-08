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
   1 | Bun Precompressed Gzip              |    70806.28 |     15.37ms | 7.90GB/s
   2 | Nginx Precompressed Gzip            |    66129.07 |     26.17ms | 7.39GB/s
   3 | Bun Precompressed Gzip Memory Cache |    56164.23 |      0.89ms | 6.27GB/s
   4 | Bun On-The-Fly Gzip                 |      373.52 |    132.95ms | 42.57MB/s
   5 | Nginx On-The-Fly Gzip               |      227.53 |    217.41ms | 25.89MB/s
```

## Key Findings

- **Bun on precompressed gzip** outperforms Nginx by ~7%
- **On-the-fly gzip compression** creates a severe CPU bottleneck (only ~300-400 req/s)
- **Bun still outperforms Nginx** on on-the-fly gzip by ~60%
- **Memory caching on Bun** reduces performance compared to direct file serving (Bun.file optimizations are more effective)

## License

MIT