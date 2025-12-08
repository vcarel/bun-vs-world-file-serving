import { gzipSync } from "node:zlib";
import { serve } from "bun";
import { getMetadata } from "./helpers";

// Bun server with on-the-fly gzip compression
const server = serve({
  reusePort: true,

  routes: {
    "/*": async (req) => {
      const url = new URL(req.url);
      const path = url.pathname === "/" ? "/index.html" : url.pathname;
      const acceptEncoding = req.headers.get("accept-encoding") || "";
      const file = Bun.file(`dist${path}`);
      const metadata = await getMetadata(path, file);

      // Compress on-the-fly if client accepts gzip
      if (acceptEncoding.includes("gzip")) {
        const content = await file.arrayBuffer();
        const compressed = gzipSync(new Uint8Array(content));

        return new Response(compressed, {
          headers: {
            "Content-Encoding": "gzip",
            "Content-Type": metadata.type,
            "Cache-Control": "public, max-age=0, must-revalidate",
            ETag: metadata.etag,
            Vary: "Accept-Encoding",
          },
        });
      }

      // Fallback to uncompressed file
      return new Response(file, {
        headers: {
          "Content-Type": metadata.type,
          "Cache-Control": "public, max-age=0, must-revalidate",
          ETag: metadata.etag,
        },
      });
    },
  },
});

console.log(`🚀 Bun On-The-Fly Gzip Server running at ${server.url}`);
