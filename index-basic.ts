import { serve } from "bun";

// Basic Bun server - no caching, no compression
const server = serve({
  reusePort: true,

  routes: {
    "/*": async (req) => {
      const url = new URL(req.url);
      const path = url.pathname === "/" ? "/index.html" : url.pathname;
      const file = Bun.file(`dist${path}`);

      return new Response(file, {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    },
  },
});

console.log(`🚀 Bun Basic Server running at ${server.url}`);
