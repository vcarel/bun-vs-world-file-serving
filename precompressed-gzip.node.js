import cluster from "node:cluster";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";

// Generate ETag using Nginx algorithm: "{mtime-hex}-{size-hex}"
function generateETag(mtime, size) {
  const mtimeHex = Math.floor(mtime / 1000).toString(16);
  const sizeHex = size.toString(16);
  return `"${mtimeHex}-${sizeHex}"`;
}

// Metadata cache only (not file contents)
const metadataCache = new Map();

// Get MIME type from file extension
function getMimeType(path) {
  const ext = path.split(".").pop()?.toLowerCase();
  const mimeTypes = {
    html: "text/html",
    js: "application/javascript",
    css: "text/css",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    ico: "image/x-icon",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    eot: "application/vnd.ms-fontobject",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

// Get or generate metadata for a file path
function getMetadata(path) {
  let metadata = metadataCache.get(path);
  if (!metadata) {
    const filePath = join("dist", path);
    const stat = statSync(filePath);
    metadata = {
      type: getMimeType(path),
      etag: generateETag(stat.mtime.getTime(), stat.size),
    };
    metadataCache.set(path, metadata);
  }
  return metadata;
}

// Node.js server with streaming from disk
function startServer() {
  const server = createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname === "/" ? "/index.html" : url.pathname;
    const acceptEncoding = req.headers["accept-encoding"] || "";
    const filePath = join("dist", path);

    // Check if file exists
    if (!existsSync(filePath)) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
      return;
    }

    const metadata = getMetadata(path);

    // Serve pre-compressed .gz file if client accepts gzip
    if (acceptEncoding.includes("gzip")) {
      const gzPath = `${filePath}.gz`;

      if (existsSync(gzPath)) {
        const gzStat = statSync(gzPath);

        res.writeHead(200, {
          "Content-Encoding": "gzip",
          "Content-Type": metadata.type,
          "Content-Length": gzStat.size,
          "Cache-Control": "public, max-age=0, must-revalidate",
          ETag: metadata.etag,
          Vary: "Accept-Encoding",
        });

        createReadStream(gzPath).pipe(res);
        return;
      }
    }

    // Fallback to uncompressed file
    const stat = statSync(filePath);
    res.writeHead(200, {
      "Content-Type": metadata.type,
      "Content-Length": stat.size,
      "Cache-Control": "public, max-age=0, must-revalidate",
      ETag: metadata.etag,
    });

    createReadStream(filePath).pipe(res);
  });

  server.listen(9000, () => {
    console.log(
      `🚀 Node.js precompressed gzip Server running at http://localhost:9000 (PID: ${process.pid})`,
    );
  });
}

// Cluster setup for multi-core performance
const WORKERS = Number.parseInt(process.env.WORKERS || "2", 10);

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} is running`);
  console.log(`Starting ${WORKERS} workers...`);

  for (let i = 0; i < WORKERS; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork();
  });
} else {
  startServer();
}
