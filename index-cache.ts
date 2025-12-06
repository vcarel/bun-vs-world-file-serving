import { serve } from "bun";

// In-memory file cache - store actual file content in RAM
const fileCache = new Map<string, { content: ArrayBuffer; type: string }>();

// Bun server with true in-memory file caching
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
        // Load entire file into RAM (trades memory for eliminating disk I/O)
        const content = await file.arrayBuffer();
        cached = { content, type: file.type };
        fileCache.set(path, cached);
      }

      return new Response(cached.content, {
        headers: {
          "Content-Type": cached.type,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    },
  },
});

console.log(`🚀 Bun Cached Server running at ${server.url}`);
console.log(`📦 Cache size: ${fileCache.size} files`);
