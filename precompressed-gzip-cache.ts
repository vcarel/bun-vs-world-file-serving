import { serve } from "bun";

// In-memory file cache with pre-compressed gzip files - store actual content in RAM
const fileCache = new Map<
  string,
  {
    raw: { content: ArrayBuffer; type: string };
    gzip?: ArrayBuffer;
  }
>();

// Bun server with true in-memory caching + pre-compressed gzip files
const server = serve({
  reusePort: true,

  routes: {
    "/*": async (req) => {
      const url = new URL(req.url);
      const path = url.pathname === "/" ? "/index.html" : url.pathname;

      // Check cache first
      let cached = fileCache.get(path);

      if (!cached) {
        const file = Bun.file(`dist${path}`);
        // Load entire file into RAM
        const raw = await file.arrayBuffer();

        cached = {
          raw: { content: raw, type: file.type },
        };

        // Load pre-compressed .gz file into RAM if it exists
        const gzFile = Bun.file(`dist${path}.gz`);
        if (await gzFile.exists()) {
          cached.gzip = await gzFile.arrayBuffer();
        }

        fileCache.set(path, cached);
      }

      const acceptEncoding = req.headers.get("accept-encoding") || "";

      if (acceptEncoding.includes("gzip") && cached.gzip) {
        return new Response(cached.gzip, {
          headers: {
            "Content-Encoding": "gzip",
            "Content-Type": cached.raw.type,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }

      return new Response(cached.raw.content, {
        headers: {
          "Content-Type": cached.raw.type,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    },
  },
});

console.log(`🚀 Bun Full Server running at ${server.url}`);
console.log(`📦 Cache size: ${fileCache.size} files`);
