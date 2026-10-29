import cluster from "node:cluster";

if (process.env.NODE_ENV !== "production") {
  console.error("❌ Clustering is only supported in production mode.");
  process.exit(1);
}

if (cluster.isPrimary) {
  const numWorkers = Number.parseInt(process.env.WORKERS || "2", 10);

  const MODE = process.env.MODE || "precompressed-gzip";

  console.log("========================================");
  console.log("🎯 Bun Cluster Server");
  console.log("========================================");
  console.log(`Primary process: ${process.pid}`);
  console.log(`Workers: ${numWorkers}`);
  console.log(`Mode: ${MODE}`);
  console.log("========================================\n");

  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    console.log(
      `❌ Worker ${worker.process.pid} died (code: ${code}, signal: ${signal}). Restarting...`,
    );
    cluster.fork();
  });

  cluster.on("online", (worker) => {
    console.log(`✅ Worker ${worker.process.pid} is online`);
  });

  const shutdown = () => {
    console.log("\n🛑 Shutting down primary process...");
    for (const id in cluster.workers) {
      cluster.workers[id]?.kill();
    }
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
} else {
  // Import the appropriate server based on MODE
  const MODE = process.env.MODE || "precompressed-gzip";

  switch (MODE) {
    case "precompressed-gzip-memory-cache":
      await import("./precompressed-gzip-memory-cache.ts");
      break;
    case "precompressed-gzip":
      await import("./precompressed-gzip.ts");
      break;
    case "on-the-fly-gzip":
      await import("./on-the-fly-gzip.ts");
      break;
    default:
      throw new Error(
        `Invalid MODE: ${MODE}. Valid modes: precompressed-gzip-memory-cache, precompressed-gzip, on-the-fly-gzip`,
      );
  }
}
