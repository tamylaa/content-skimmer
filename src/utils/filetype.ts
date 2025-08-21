// Enhanced file type detection utility

export interface FileTypeInfo {
  type: string;
  category: 'text' | 'document' | 'image' | 'video' | 'audio' | 'archive' | 'spreadsheet' | 'presentation' | 'unknown';
  mimeType: string;
  isProcessable: boolean;
  extractionMethod: 'text' | 'ocr' | 'ai' | 'metadata' | 'unsupported';
}

export function detectFileType(filename: string): string {
  const info = getFileTypeInfo(filename);
  return info.type;
}

export function getFileTypeInfo(filename: string): FileTypeInfo {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return createFileTypeInfo('unknown', 'unknown', 'application/octet-stream', false, 'unsupported');

  // Text files
  if (['txt', 'md', 'markdown', 'rtf', 'csv', 'json', 'xml', 'html', 'htm'].includes(ext)) {
    return createFileTypeInfo('text', 'text', getMimeType(ext), true, 'text');
  }

  // Document files
  if (['pdf', 'doc', 'docx', 'odt', 'pages'].includes(ext)) {
    return createFileTypeInfo('document', 'document', getMimeType(ext), true, 'ai');
  }

  // Spreadsheet files
  if (['xls', 'xlsx', 'ods', 'numbers', 'csv'].includes(ext)) {
    return createFileTypeInfo('spreadsheet', 'spreadsheet', getMimeType(ext), true, 'ai');
  }

  // Presentation files
  if (['ppt', 'pptx', 'odp', 'key'].includes(ext)) {
    return createFileTypeInfo('presentation', 'presentation', getMimeType(ext), true, 'ai');
  }

  // Image files
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'svg'].includes(ext)) {
    return createFileTypeInfo('image', 'image', getMimeType(ext), true, 'ocr');
  }

  // Video files
  if (['mp4', 'webm', 'mov', 'avi', 'mkv', 'wmv', 'flv', '3gp'].includes(ext)) {
    return createFileTypeInfo('video', 'video', getMimeType(ext), true, 'ai');
  }

  // Audio files
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'].includes(ext)) {
    return createFileTypeInfo('audio', 'audio', getMimeType(ext), true, 'ai');
  }

  // Archive files
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext)) {
    return createFileTypeInfo('archive', 'archive', getMimeType(ext), false, 'metadata');
  }

  return createFileTypeInfo('unknown', 'unknown', 'application/octet-stream', false, 'unsupported');
}

function createFileTypeInfo(
  type: string,
  category: FileTypeInfo['category'],
  mimeType: string,
  isProcessable: boolean,
  extractionMethod: FileTypeInfo['extractionMethod']
): FileTypeInfo {
  return { type, category, mimeType, isProcessable, extractionMethod };
}

function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    // Text
    'txt': 'text/plain',
    'md': 'text/markdown',
    'markdown': 'text/markdown',
    'rtf': 'application/rtf',
    'csv': 'text/csv',
    'json': 'application/json',
    'xml': 'application/xml',
    'html': 'text/html',
    'htm': 'text/html',

    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'odt': 'application/vnd.oasis.opendocument.text',
    'pages': 'application/vnd.apple.pages',

    // Spreadsheets
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ods': 'application/vnd.oasis.opendocument.spreadsheet',
    'numbers': 'application/vnd.apple.numbers',

    // Presentations
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'odp': 'application/vnd.oasis.opendocument.presentation',
    'key': 'application/vnd.apple.keynote',

    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'tiff': 'image/tiff',
    'svg': 'image/svg+xml',

    // Video
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'mkv': 'video/x-matroska',
    'wmv': 'video/x-ms-wmv',
    'flv': 'video/x-flv',
    '3gp': 'video/3gpp',

    // Audio
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'flac': 'audio/flac',
    'aac': 'audio/aac',
    'ogg': 'audio/ogg',
    'm4a': 'audio/m4a',
    'wma': 'audio/x-ms-wma',

    // Archives
    'zip': 'application/zip',
    'rar': 'application/vnd.rar',
    '7z': 'application/x-7z-compressed',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',
    'bz2': 'application/x-bzip2',
    'xz': 'application/x-xz'
  };

  return mimeTypes[ext] || 'application/octet-stream';
}

export function isTextExtractable(filename: string): boolean {
  const info = getFileTypeInfo(filename);
  return info.isProcessable && ['text', 'ai', 'ocr'].includes(info.extractionMethod);
}

export function getExtractionStrategy(filename: string): FileTypeInfo['extractionMethod'] {
  const info = getFileTypeInfo(filename);
  return info.extractionMethod;
}

export function supportsAIAnalysis(filename: string): boolean {
  const info = getFileTypeInfo(filename);
  return info.isProcessable && ['text', 'ai', 'ocr'].includes(info.extractionMethod);
}
