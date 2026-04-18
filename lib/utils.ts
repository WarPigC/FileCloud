export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.startsWith("video/")) return "🎬";
  if (mimeType.startsWith("audio/")) return "🎵";
  if (mimeType.includes("pdf")) return "📕";
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("tar") || mimeType.includes("gzip")) return "📦";
  if (mimeType.includes("word") || mimeType.includes("document")) return "📝";
  if (mimeType.includes("sheet") || mimeType.includes("excel") || mimeType.includes("csv")) return "📊";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "📙";
  if (mimeType.includes("text") || mimeType.includes("json") || mimeType.includes("xml")) return "📄";
  if (mimeType.includes("javascript") || mimeType.includes("typescript") || mimeType.includes("python") || mimeType.includes("java")) return "💻";
  return "📎";
}

export function getFileColor(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "rgba(99, 102, 241, 0.15)";
  if (mimeType.startsWith("video/")) return "rgba(168, 85, 247, 0.15)";
  if (mimeType.startsWith("audio/")) return "rgba(236, 72, 153, 0.15)";
  if (mimeType.includes("pdf")) return "rgba(239, 68, 68, 0.15)";
  if (mimeType.includes("zip") || mimeType.includes("rar")) return "rgba(245, 158, 11, 0.15)";
  if (mimeType.includes("word") || mimeType.includes("document")) return "rgba(59, 130, 246, 0.15)";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "rgba(34, 197, 94, 0.15)";
  return "rgba(100, 116, 139, 0.15)";
}

export function timeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
