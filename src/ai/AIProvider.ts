// Abstract interface for AI providers

export interface AIAnalysisResult {
  summary: string;
  entities: string[];
  topics: string[];
  language?: string;
  sentiment?: string;
  enrichment: object;
}

export abstract class AIProvider {
  abstract analyzeContent(content: string, mimeType: string): Promise<AIAnalysisResult>;
  abstract extractText(buffer: ArrayBuffer, mimeType: string): Promise<string>;
  abstract isSupported(mimeType: string): boolean;
}