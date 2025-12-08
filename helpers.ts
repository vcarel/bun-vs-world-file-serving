// Generate ETag using Nginx algorithm: "{mtime-hex}-{size-hex}"
export function generateETag(mtime: number, size: number) {
  const mtimeHex = Math.floor(mtime / 1000).toString(16);
  const sizeHex = size.toString(16);
  return `"${mtimeHex}-${sizeHex}"`;
}

// Cache for file metadata (type, etag)
const metadataCache = new Map<string, { type: string; etag: string }>();

// Get or generate metadata for a file path
export async function getMetadata(path: string, file: ReturnType<typeof Bun.file>) {
  let metadata = metadataCache.get(path);
  if (!metadata) {
    const stat = await file.stat();
    metadata = {
      type: file.type,
      etag: generateETag(stat.mtime.getTime(), stat.size),
    };
    metadataCache.set(path, metadata);
  }
  return metadata;
}
