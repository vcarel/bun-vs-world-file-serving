import { gzipSync } from "node:zlib";
import { serve } from "bun";

// Cache file types to avoid opening files twice
const typeCache = new Map<string, string>();

// Bun server with on-the-fly gzip compression
const server = serve({
  reusePort: true,

  routes: {
    "/*": async (req) => {
      const url = new URL(req.url);
      const path = url.pathname === "/" ? "/index.html" : url.pathname;

      const acceptEncoding = req.headers.get("accept-encoding") || "";

      const file = Bun.file(`dist${path}`);

      // Get cached type or determine it once
      let contentType = typeCache.get(path);
      if (!contentType) {
        contentType = file.type;
        typeCache.set(path, contentType);
      }

      // Compress on-the-fly if client accepts gzip
      if (acceptEncoding.includes("gzip")) {
        const content = await file.arrayBuffer();
        const compressed = gzipSync(new Uint8Array(content));

        return new Response(compressed, {
          headers: {
            "Content-Encoding": "gzip",
            "Content-Type": contentType,
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        });
      }

      // Fallback to uncompressed file
      return new Response(file, {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    },
  },
});

console.log(`🚀 Bun On-The-Fly Gzip Server running at ${server.url}`);
