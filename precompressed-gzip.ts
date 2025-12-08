import { serve } from "bun";

// Cache file types to avoid opening files twice
const typeCache = new Map<string, string>();

// Bun server with pre-compressed gzip files (gzip_static equivalent)
const server = serve({
  reusePort: true,

  routes: {
    "/*": async (req) => {
      const url = new URL(req.url);
      const path = url.pathname === "/" ? "/index.html" : url.pathname;

      const acceptEncoding = req.headers.get("accept-encoding") || "";

      // Serve pre-compressed .gz file if client accepts gzip
      if (acceptEncoding.includes("gzip")) {
        const gzFile = Bun.file(`dist${path}.gz`);

        // Get cached type or determine it once
        let contentType = typeCache.get(path);
        if (!contentType) {
          contentType = Bun.file(`dist${path}`).type;
          typeCache.set(path, contentType);
        }

        return new Response(gzFile, {
          headers: {
            "Content-Encoding": "gzip",
            "Content-Type": contentType,
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        });
      }

      // Fallback to uncompressed file
      const file = Bun.file(`dist${path}`);
      return new Response(file, {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    },
  },
});

console.log(`🚀 Bun Gzip Server running at ${server.url}`);
