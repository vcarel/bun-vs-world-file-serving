Benchmark of static file serving: Bun, Node.js, Python, Ruby and Nginx, with precompressed gzip vs on-the-fly compression.

- Tool versions are pinned in `.tool-versions` (mise). Nginx runs in Docker, its version is pinned in the Dockerfiles.
- `bun run build` bundles `src/` into `dist/` and writes a `.gz` next to each file.
- `bun benchmark.ts` runs every server one after the other with bombardier. The Docker daemon must be running.
- All servers listen on port 9000. The worker count and the CPUs the server is pinned to are set in `benchmark.ts`.
- Use Bun for tooling (`bun install`, `bun run`, `bunx`). The Node.js, Python and Ruby servers are compared on purpose, keep them.
- `bun run check` (Biome) and `bun run typecheck` must pass.
