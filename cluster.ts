import cluster from "node:cluster";
import { cpus } from "node:os";

if (process.env.NODE_ENV !== "production") {
  console.error("❌ Clustering is only supported in production mode.");
  process.exit(1);
}

if (cluster.isPrimary) {
  // Railway doesn't expose container CPU limits reliably, so use env var or fallback to CPU count
  const numWorkers = process.env.WEB_CONCURRENCY
    ? Number.parseInt(process.env.WEB_CONCURRENCY, 10)
    : cpus().length;
  console.log(`🎯 Primary process ${process.pid} starting ${numWorkers} workers...`);

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

  // Graceful shutdown
  const shutdown = () => {
    console.log("\n🛑 Shutting down primary process...");
    for (const id in cluster.workers) {
      cluster.workers[id]?.kill();
    }
    process.exit(0);
  };

  process.on("SIGINT", shutdown); // Ctrl+C locally
  process.on("SIGTERM", shutdown); // Railway/Docker shutdown
} else {
  // Worker process - import and run your server
  await import("./index.ts");
}
