import { serve } from "bun";
import { getMetadata } from "./helpers";

// Bun server with pre-compressed gzip files (gzip_static equivalent)
const server = serve({
  port: 9000,
  reusePort: true,

  routes: {
    "/*": async (req) => {
      const url = new URL(req.url);
      const path = url.pathname === "/" ? "/index.html" : url.pathname;
      const acceptEncoding = req.headers.get("accept-encoding") || "";
      const file = Bun.file(`dist${path}`);
      const metadata = await getMetadata(path, file);

      // Serve pre-compressed .gz file if client accepts gzip
      if (acceptEncoding.includes("gzip")) {
        const gzFile = Bun.file(`dist${path}.gz`);

        return new Response(gzFile, {
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

console.log(`🚀 Bun Gzip Server running at ${server.url}`);
