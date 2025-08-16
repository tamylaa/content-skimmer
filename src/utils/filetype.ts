// File type detection utility (stub)
export function detectFileType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return 'unknown';
  if (["txt", "md", "csv", "json"].includes(ext)) return "text";
  if (["pdf"].includes(ext)) return "pdf";
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
  if (["mp4", "webm", "mov"].includes(ext)) return "video";
  // Add more as needed
  return 'unknown';
}
