import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "bun";

// Build the project
console.log("🔨 Building project...");
await Bun.$`rm -rf dist/`;
await Bun.$`bun build src/index.html --outdir=dist --minify`;

// Function to recursively get all files in a directory
function getAllFiles(dir: string, files: string[] = []) {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      getAllFiles(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

// Gzip all files in dist
console.log("📦 Generating gzipped versions...");
const distFiles = getAllFiles("dist");
let gzipCount = 0;

for (const filePath of distFiles) {
  // Skip already gzipped files
  if (filePath.endsWith(".gz")) continue;

  // Read file
  const file = Bun.file(filePath);
  const content = await file.arrayBuffer();

  // Gzip and save
  const compressed = gzipSync(content);
  await Bun.write(`${filePath}.gz`, compressed);

  const originalSize = content.byteLength;
  const compressedSize = compressed.byteLength;
  const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

  console.log(`  ✓ ${filePath.replace("dist/", "")} (${ratio}% smaller)`);
  gzipCount++;
}

console.log(`\n✅ Build complete! Generated ${gzipCount} gzipped files.`);
