import cluster from "node:cluster";

if (process.env.NODE_ENV !== "production") {
  console.error("❌ Clustering is only supported in production mode.");
  process.exit(1);
}

if (cluster.isPrimary) {
  const numWorkers = 2;

  const USE_CACHE = process.env.USE_CACHE === "true";
  const USE_GZIP = process.env.USE_GZIP === "true";

  console.log("========================================");
  console.log("🎯 Bun Cluster Server");
  console.log("========================================");
  console.log(`Primary process: ${process.pid}`);
  console.log(`Workers: ${numWorkers}`);
  console.log(`Memory Cache: ${USE_CACHE ? "✅ Enabled" : "❌ Disabled"}`);
  console.log(`Gzip: ${USE_GZIP ? "✅ Enabled" : "❌ Disabled"}`);
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
  // Import the appropriate server based on configuration
  const USE_CACHE = process.env.USE_CACHE === "true";
  const USE_GZIP = process.env.USE_GZIP === "true";

  if (USE_CACHE && USE_GZIP) {
    await import("./index-full.ts");
  } else if (USE_CACHE) {
    await import("./index-cache.ts");
  } else if (USE_GZIP) {
    await import("./index-gzip.ts");
  } else {
    await import("./index-basic.ts");
  }
}
