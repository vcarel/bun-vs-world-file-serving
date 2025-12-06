import { serve } from "bun";

const isProd = process.env.NODE_ENV === "production";

const getServer = async () => {
  if (isProd) {
    return serve({
      reusePort: true,

      routes: {
        "/*": async (req) => {
          const url = new URL(req.url);
          const path = url.pathname === "/" ? "/index.html" : url.pathname;
          const file = Bun.file(`dist${path}`);

          return new Response(file);
        },
      },
    });
  }

  return serve({
    development: {
      hmr: true, // Enable browser hot reloading in development
      console: true, // Echo console logs from the browser to the server
    },

    routes: {
      "/*": (await import("@/index.html")).default,
    },
  });
};

const server = await getServer();

console.log(`🚀 Server running at ${server.url}`);
