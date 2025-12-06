# Bun vs Nginx Performance Benchmark

A comprehensive performance comparison between **Bun** and **Nginx** static file servers, testing various configurations with and without caching and gzip compression.

## Purpose

This benchmark compares the throughput and latency of different server configurations:

- **Bun** vs **Nginx** static file serving
- With and without **memory/file caching**
- With and without **pre-compressed gzip files**
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
- [Docker](https://www.docker.com/) (for Nginx containers)
- [Bombardier](https://github.com/codesenberg/bombardier) HTTP benchmarking tool

## Installation

Clone the repository and install dependencies:

```bash
bun install
```

## Running the Benchmark

Run all benchmarks (Bun and Nginx configurations):

```bash
bun benchmark.ts
```

This will:
1. Build Docker images for Nginx configurations
2. Run benchmarks for 8 different server configurations
3. Generate `benchmark-results.json` with detailed results
4. Display a summary table sorted by requests/second

## Benchmark Results

```
========================================
  BENCHMARK RESULTS SUMMARY
========================================

Rank | Server                              | Reqs/sec    | Avg Latency | Throughput
-----+-------------------------------------+-------------+-------------+-----------
   1 | Bun Basic (No Cache, No Gzip)       |    34459.54 |      1.45ms | 12.58GB/s
   2 | Bun + Gzip                          |    34208.29 |      1.46ms | 12.49GB/s
   3 | Nginx + File Cache                  |    30497.62 |      1.64ms | 11.14GB/s
   4 | Nginx + File Cache + Gzip           |    30404.59 |      1.64ms | 11.10GB/s
   5 | Nginx Basic (No Cache, No Gzip)     |    28055.04 |      1.78ms | 10.24GB/s
   6 | Nginx + Gzip                        |    26808.15 |      1.86ms | 9.79GB/s
   7 | Bun + Memory Cache                  |    22643.16 |      2.21ms | 8.26GB/s
   8 | Bun + Memory Cache + Gzip           |    22124.58 |      2.26ms | 8.08GB/s
```

## Key Findings

- **Bun outperforms Nginx** by ~10-20%
- **Bun memory caching** is less effective than Bun.file optimizations
- **File cache in Nginx** provides significant improvements over basic configuration

## License

MIT