interface BenchmarkResult {
  name: string;
  reqsPerSec: number;
  latencyAvg: number;
  throughput: string;
}

const DURATION = "20s";
const CONNECTIONS = "50";
const WORKERS = "2";
const GOMAXPROCS = "6";
const PORT = "9000";
// CPUs the tested server is pinned to, bombardier uses the others
const SERVER_CPUS = "0,1";

const results: BenchmarkResult[] = [];

const MILLISECONDS_PER_UNIT: Record<string, number> = { us: 0.001, ms: 1, s: 1000, m: 60000 };

function convertDurationToMs(durationText: string): number {
  const match = durationText.match(/^([\d.]+)(us|ms|s|m)$/);
  return match?.[1] && match[2] ? parseFloat(match[1]) * (MILLISECONDS_PER_UNIT[match[2]] ?? 0) : 0;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SERVER_READY_TIMEOUT_MS = 30_000;

async function isServerResponding(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { headers: { "Accept-Encoding": "gzip" } });
    await response.arrayBuffer();
    return response.ok;
  } catch {
    return false;
  }
}

// A fixed delay is either too short (the first requests are refused and counted
// as throughput) or wastes time, so poll until the server serves the file
async function waitForServerReady(url: string, serverProcess?: Bun.Subprocess): Promise<void> {
  const deadline = Date.now() + SERVER_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (serverProcess?.exitCode != null) {
      throw new Error(`Server exited with code ${serverProcess.exitCode} before being ready`);
    }
    if (await isServerResponding(url)) return;
    await sleep(100);
  }
  throw new Error(`Server did not serve ${url} within ${SERVER_READY_TIMEOUT_MS / 1000}s`);
}

// Bombardier counts refused connections and error statuses in Reqs/sec,
// so any of them makes the result meaningless
function countFailedRequests(bombardierOutput: string): number {
  return [...bombardierOutput.matchAll(/\b(1xx|3xx|4xx|5xx|others) - (\d+)/g)]
    .map((match) => Number(match[2]))
    .reduce((total, count) => total + count, 0);
}

function parseBenchmarkResult(name: string, bombardierOutput: string): BenchmarkResult {
  const reqsMatch = bombardierOutput.match(/Reqs\/sec\s+(\d+\.\d+)/);
  // Bombardier prints the average latency with its own unit (us, ms, s)
  const latencyMatch = bombardierOutput.match(/Latency\s+(\S+)/);
  const throughputMatch = bombardierOutput.match(/Throughput:\s+([\d.]+\w+\/s)/);

  if (!reqsMatch?.[1]) {
    throw new Error(`Could not parse bombardier output for ${name}`);
  }
  return {
    name,
    reqsPerSec: parseFloat(reqsMatch[1]),
    latencyAvg: latencyMatch?.[1] ? convertDurationToMs(latencyMatch[1]) : 0,
    throughput: throughputMatch?.[1] ?? "N/A",
  };
}

async function runBenchmark(
  name: string,
  command: string,
  isDocker: boolean,
  benchmarkUrl: string,
  extraEnv: Record<string, string> = {},
): Promise<void> {
  console.log(`\n📊 Testing: ${name}`);

  let proc: Bun.Subprocess | undefined;

  try {
    // Start server
    if (isDocker) {
      // Clean up any existing container first
      await Bun.$`docker stop perf-test 2>/dev/null || true`.quiet();
      await Bun.$`docker rm perf-test 2>/dev/null || true`.quiet();

      await Bun.$`${command.split(" ")}`.quiet();
      await waitForServerReady(benchmarkUrl);
    } else {
      const tasksetCmd = ["taskset", "-c", SERVER_CPUS, ...command.split(" ")];
      proc = Bun.spawn(tasksetCmd, {
        env: {
          ...process.env,
          NODE_ENV: "production",
          WORKERS,
          ...extraEnv,
        },
        stdout: "pipe",
        stderr: "pipe",
      });
      await waitForServerReady(benchmarkUrl, proc);
    }

    // Run bombardier with Accept-Encoding header
    const output =
      await Bun.$`bombardier -c ${CONNECTIONS} -d ${DURATION} -H "Accept-Encoding: gzip" ${benchmarkUrl}`
        .env({ GOMAXPROCS })
        .text();

    console.log(output);

    const failedRequestCount = countFailedRequests(output);
    if (failedRequestCount > 0) {
      throw new Error(`${name}: ${failedRequestCount} requests failed`);
    }

    results.push(parseBenchmarkResult(name, output));
  } finally {
    // Stop server, even when the benchmark failed, so the port is free again
    if (isDocker) {
      await Bun.$`docker stop perf-test 2>/dev/null || true`.quiet();
      await Bun.$`docker rm perf-test 2>/dev/null || true`.quiet();
    } else if (proc) {
      proc.kill();
      await proc.exited;
    }
  }

  await sleep(2000);
}

async function main() {
  console.log("========================================");
  console.log("  Static File Serving Benchmark");
  console.log("========================================");
  console.log("");
  console.log("Configuration:");
  console.log(`  Duration: ${DURATION}`);
  console.log(`  Connections: ${CONNECTIONS}`);
  console.log(`  Workers: ${WORKERS}`);
  console.log(`  GOMAXPROCS: ${GOMAXPROCS}`);
  console.log("");
  console.log("Benchmarking 8 configurations:");
  console.log("  - 3 Bun variants");
  console.log("  - 1 Node.js");
  console.log("  - 1 Python");
  console.log("  - 1 Ruby");
  console.log("  - 2 Nginx");
  console.log("");

  // Build dist files
  console.log("🔨 Building dist files...");
  await Bun.$`bun run build`;

  // Find the generated JS file (it will have a hash in the name)
  const distDir = await Bun.$`ls dist`.text();
  const jsFile = distDir.split("\n").find((f) => f.endsWith(".js") && f.startsWith("index-"));

  if (!jsFile) {
    throw new Error("Could not find generated JS file in dist/");
  }

  console.log(`📄 Testing with file: ${jsFile}`);

  // Update the benchmark URL
  const BENCHMARK_URL = `http://localhost:${PORT}/${jsFile}`;

  console.log("\n🚀 Starting benchmarks...\n");

  // Bun Benchmarks
  console.log("=== BUN SERVERS ===");

  // All use the same cluster.ts file with different MODE values
  await runBenchmark("Bun precompressed gzip", "bun cluster.ts", false, BENCHMARK_URL, {
    MODE: "precompressed-gzip",
  });
  await runBenchmark(
    "Bun precompressed gzip memory cache",
    "bun cluster.ts",
    false,
    BENCHMARK_URL,
    {
      MODE: "precompressed-gzip-memory-cache",
    },
  );
  await runBenchmark("Bun on-the-fly gzip", "bun cluster.ts", false, BENCHMARK_URL, {
    MODE: "on-the-fly-gzip",
  });

  // Node.js Benchmarks
  console.log("\n=== NODE.JS SERVERS ===");

  await runBenchmark(
    "Node.js precompressed gzip",
    "node precompressed-gzip.node.js",
    false,
    BENCHMARK_URL,
  );

  // Python Benchmarks
  console.log("\n=== PYTHON SERVERS ===");

  await runBenchmark(
    "Python precompressed gzip",
    "python3 precompressed-gzip.py",
    false,
    BENCHMARK_URL,
  );

  // Ruby Benchmarks
  console.log("\n=== RUBY SERVERS ===");

  await runBenchmark("Ruby precompressed gzip", "ruby precompressed-gzip.rb", false, BENCHMARK_URL);

  // Nginx Benchmarks
  console.log("\n=== NGINX SERVERS ===");

  console.log("\n🐳 Building Nginx Docker images...");
  await Bun.$`docker build --build-arg WORKERS=${WORKERS} -f Dockerfile.nginx-precompressed-gzip -t nginx-precompressed-gzip .`.quiet();
  await Bun.$`docker build --build-arg WORKERS=${WORKERS} -f Dockerfile.nginx-on-the-fly-gzip -t nginx-on-the-fly-gzip .`.quiet();

  const distPath = `${process.cwd()}/dist`;

  await runBenchmark(
    "Nginx precompressed gzip",
    `docker run -d --name perf-test --cpuset-cpus=${SERVER_CPUS} -v ${distPath}:/var/www/html:ro --network host nginx-precompressed-gzip`,
    true,
    BENCHMARK_URL,
  );
  await runBenchmark(
    "Nginx on-the-fly gzip",
    `docker run -d --name perf-test --cpuset-cpus=${SERVER_CPUS} -v ${distPath}:/var/www/html:ro --network host nginx-on-the-fly-gzip`,
    true,
    BENCHMARK_URL,
  );

  // Display summary
  console.log("\n========================================");
  console.log("  BENCHMARK RESULTS SUMMARY");
  console.log("========================================\n");

  console.log(
    "Rank | Server                              | Reqs/sec    | Avg Latency | Throughput",
  );
  console.log(
    "-----+-------------------------------------+-------------+-------------+-----------",
  );

  const sorted = [...results].sort((a, b) => b.reqsPerSec - a.reqsPerSec);

  sorted.forEach((result, index) => {
    console.log(
      `${(index + 1).toString().padStart(4)} | ${result.name.padEnd(35)} | ${result.reqsPerSec.toFixed(2).padStart(11)} | ${result.latencyAvg.toFixed(2).padStart(9)}ms | ${result.throughput}`,
    );
  });

  console.log("");

  // Save to file
  await Bun.write("benchmark-results.json", JSON.stringify(sorted, null, 2));
  console.log("📝 Results saved to: benchmark-results.json");
}

main().catch((error) => {
  console.error(`❌ Benchmark stopped: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
