// Text extraction service for different file types

import { getFileTypeInfo, FileTypeInfo } from '../utils/filetype.js';

export interface TextExtractionResult {
  text: string;
  metadata: {
    method: string;
    confidence: number;
    language?: string;
    pageCount?: number;
    wordCount: number;
    extractedAt: string;
  };
  error?: string;
}

export class TextExtractionService {
  async extractText(buffer: ArrayBuffer, filename: string, mimeType?: string): Promise<TextExtractionResult> {
    const fileInfo = getFileTypeInfo(filename);
    
    try {
      switch (fileInfo.extractionMethod) {
        case 'text':
          return this.extractFromTextFile(buffer, fileInfo);
        case 'ai':
          return this.extractWithAI(buffer, fileInfo);
        case 'ocr':
          return this.extractWithOCR(buffer, fileInfo);
        case 'metadata':
          return this.extractMetadataOnly(buffer, fileInfo);
        default:
          throw new Error(`Unsupported file type: ${fileInfo.type}`);
      }
    } catch (error) {
      return {
        text: '',
        metadata: {
          method: 'error',
          confidence: 0,
          wordCount: 0,
          extractedAt: new Date().toISOString()
        },
        error: (error as Error).message
      };
    }
  }

  private async extractFromTextFile(buffer: ArrayBuffer, fileInfo: FileTypeInfo): Promise<TextExtractionResult> {
    const text = new TextDecoder('utf-8').decode(buffer);
    
    return {
      text,
      metadata: {
        method: 'direct_text',
        confidence: 1.0,
        language: this.detectLanguage(text),
        wordCount: this.countWords(text),
        extractedAt: new Date().toISOString()
      }
    };
  }

  private async extractWithAI(buffer: ArrayBuffer, fileInfo: FileTypeInfo): Promise<TextExtractionResult> {
    // For now, implement basic extraction for common formats
    // In production, integrate with specialized libraries or AI services
    
    if (fileInfo.type === 'document') {
      return this.extractFromDocument(buffer, fileInfo);
    }
    
    if (fileInfo.category === 'video' || fileInfo.category === 'audio') {
      return this.extractFromMedia(buffer, fileInfo);
    }

    // Fallback to basic text extraction
    try {
      const text = new TextDecoder('utf-8').decode(buffer);
      return {
        text,
        metadata: {
          method: 'fallback_text',
          confidence: 0.7,
          language: this.detectLanguage(text),
          wordCount: this.countWords(text),
          extractedAt: new Date().toISOString()
        }
      };
    } catch {
      throw new Error(`Cannot extract text from ${fileInfo.type} file`);
    }
  }

  private async extractWithOCR(buffer: ArrayBuffer, fileInfo: FileTypeInfo): Promise<TextExtractionResult> {
    // Placeholder for OCR implementation
    // In production, integrate with Cloudflare AI or external OCR service
    
    return {
      text: '[OCR extraction not implemented - placeholder text for image content]',
      metadata: {
        method: 'ocr_placeholder',
        confidence: 0.5,
        language: 'en',
        wordCount: 10,
        extractedAt: new Date().toISOString()
      }
    };
  }

  private async extractMetadataOnly(buffer: ArrayBuffer, fileInfo: FileTypeInfo): Promise<TextExtractionResult> {
    // Extract basic metadata without full content
    const sizeKB = Math.round(buffer.byteLength / 1024);
    
    return {
      text: `Archive file: ${fileInfo.type}, Size: ${sizeKB}KB`,
      metadata: {
        method: 'metadata_only',
        confidence: 1.0,
        wordCount: 5,
        extractedAt: new Date().toISOString()
      }
    };
  }

  private async extractFromDocument(buffer: ArrayBuffer, fileInfo: FileTypeInfo): Promise<TextExtractionResult> {
    // Placeholder for document extraction (PDF, Word, etc.)
    // In production, use libraries like pdf-parse, mammoth, etc.
    
    if (fileInfo.mimeType === 'application/pdf') {
      return {
        text: '[PDF text extraction not implemented - requires pdf-parse library]',
        metadata: {
          method: 'pdf_placeholder',
          confidence: 0.8,
          pageCount: 1,
          wordCount: 10,
          extractedAt: new Date().toISOString()
        }
      };
    }

    if (fileInfo.mimeType.includes('word') || fileInfo.mimeType.includes('openxml')) {
      return {
        text: '[Word document extraction not implemented - requires mammoth library]',
        metadata: {
          method: 'word_placeholder',
          confidence: 0.8,
          pageCount: 1,
          wordCount: 10,
          extractedAt: new Date().toISOString()
        }
      };
    }

    throw new Error(`Document type ${fileInfo.mimeType} not supported`);
  }

  private async extractFromMedia(buffer: ArrayBuffer, fileInfo: FileTypeInfo): Promise<TextExtractionResult> {
    // Placeholder for media transcription
    // In production, integrate with Whisper API or similar
    
    if (fileInfo.category === 'audio') {
      return {
        text: '[Audio transcription not implemented - requires Whisper API]',
        metadata: {
          method: 'audio_placeholder',
          confidence: 0.7,
          language: 'en',
          wordCount: 15,
          extractedAt: new Date().toISOString()
        }
      };
    }

    if (fileInfo.category === 'video') {
      return {
        text: '[Video transcription not implemented - requires video processing and Whisper API]',
        metadata: {
          method: 'video_placeholder',
          confidence: 0.7,
          language: 'en',
          wordCount: 20,
          extractedAt: new Date().toISOString()
        }
      };
    }

    throw new Error(`Media type ${fileInfo.category} not supported`);
  }

  private detectLanguage(text: string): string {
    // Simple language detection
    const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of'];
    const spanishWords = ['el', 'la', 'y', 'o', 'pero', 'en', 'de', 'con', 'por', 'para'];
    
    const lowerText = text.toLowerCase();
    const englishCount = englishWords.filter(word => lowerText.includes(word)).length;
    const spanishCount = spanishWords.filter(word => lowerText.includes(word)).length;
    
    return englishCount > spanishCount ? 'en' : (spanishCount > 0 ? 'es' : 'unknown');
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }
}
