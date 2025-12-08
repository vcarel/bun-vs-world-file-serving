interface BenchmarkResult {
  name: string;
  reqsPerSec: number;
  latencyAvg: number;
  latencyMax: number;
  throughput: string;
}

const DURATION = "10s";
const CONNECTIONS = "50";
const WORKERS = "2";
const GOMAXPROCS = "6";
const PORT = "3000";

const results: BenchmarkResult[] = [];

async function _runCommand(cmd: string): Promise<string> {
  const proc = Bun.spawn(cmd.split(" "), {
    stdout: "pipe",
    stderr: "pipe",
  });

  const output = await new Response(proc.stdout).text();
  await proc.exited;
  return output;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  // Start server
  if (isDocker) {
    // Clean up any existing container first
    await Bun.$`docker stop perf-test 2>/dev/null || true`.quiet();
    await Bun.$`docker rm perf-test 2>/dev/null || true`.quiet();
    await sleep(500);

    await Bun.$`${command.split(" ")}`.quiet();
    await sleep(3000);
  } else {
    // Use taskset to pin to CPUs 0,1
    const tasksetCmd = ["taskset", "-c", "0,1", ...command.split(" ")];
    proc = Bun.spawn(tasksetCmd, {
      env: {
        ...process.env,
        NODE_ENV: "production",
        WEB_CONCURRENCY: WORKERS,
        ...extraEnv,
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    await sleep(1000);
  }

  // Run bombardier with Accept-Encoding header
  try {
    const output =
      await Bun.$`bombardier -c ${CONNECTIONS} -d ${DURATION} -H "Accept-Encoding: gzip" ${benchmarkUrl}`
        .env({ GOMAXPROCS })
        .text();

    console.log(output);

    // Parse results
    const reqsMatch = output.match(/Reqs\/sec\s+(\d+\.\d+)/);
    const latencyAvgMatch = output.match(/Latency.*?(\d+\.\d+)ms/);
    const latencyMaxMatch = output.match(/Max:\s+(\d+\.\d+)ms/);
    const throughputMatch = output.match(/Throughput:\s+([\d.]+\w+\/s)/);

    if (reqsMatch?.[1]) {
      results.push({
        name,
        reqsPerSec: parseFloat(reqsMatch[1]),
        latencyAvg: latencyAvgMatch?.[1] ? parseFloat(latencyAvgMatch[1]) : 0,
        latencyMax: latencyMaxMatch?.[1] ? parseFloat(latencyMaxMatch[1]) : 0,
        throughput: throughputMatch?.[1] ?? "N/A",
      });
    }
  } catch (error) {
    console.error(`❌ Benchmark failed: ${error}`);
  }

  // Stop server
  if (isDocker) {
    await Bun.$`docker stop perf-test`.quiet();
    await Bun.$`docker rm perf-test`.quiet();
  } else if (proc) {
    proc.kill();
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
  await runBenchmark("Bun Precompressed Gzip", "bun cluster.ts", false, BENCHMARK_URL, {
    MODE: "precompressed-gzip",
  });
  await runBenchmark(
    "Bun Precompressed Gzip Memory Cache",
    "bun cluster.ts",
    false,
    BENCHMARK_URL,
    {
      MODE: "precompressed-gzip-memory-cache",
    },
  );
  await runBenchmark("Bun On-The-Fly Gzip", "bun cluster.ts", false, BENCHMARK_URL, {
    MODE: "on-the-fly-gzip",
  });

  // Nginx Benchmarks
  console.log("\n=== NGINX SERVERS ===");

  console.log("\n🐳 Building Nginx Docker images...");
  await Bun.$`docker build -f Dockerfile.nginx-precompressed-gzip -t nginx-precompressed-gzip .`.quiet();
  await Bun.$`docker build -f Dockerfile.nginx-on-the-fly-gzip -t nginx-on-the-fly-gzip .`.quiet();

  const distPath = `${process.cwd()}/dist`;

  await runBenchmark(
    "Nginx Precompressed Gzip",
    `docker run -d --name perf-test --cpuset-cpus=0,1 -v ${distPath}:/var/www/html:ro -p ${PORT}:${PORT} nginx-precompressed-gzip`,
    true,
    BENCHMARK_URL,
  );
  await runBenchmark(
    "Nginx On-The-Fly Gzip",
    `docker run -d --name perf-test --cpuset-cpus=0,1 -v ${distPath}:/var/www/html:ro -p ${PORT}:${PORT} nginx-on-the-fly-gzip`,
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

main().catch(console.error);
