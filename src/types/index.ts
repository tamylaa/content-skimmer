// Core type definitions for the content-skimmer service

export interface FileRegistrationEvent {
  fileId: string;
  userId: string;
  filename: string;
  r2Key: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  signedUrl?: string;
}

export interface AnalysisResult {
  fileId: string;
  summary: string;
  entities: string[];
  topics: string[];
  enrichment: object;
  r2References: string[];
  analysisStatus: 'pending' | 'completed' | 'failed';
  error?: string;
}

export interface SearchDocument {
  id: string;
  title: string;
  summary: string;
  entities: string[];
  topics: string[];
  userId: string;
  filename: string;
  mimeType: string;
  uploadedAt: string;
  lastAnalyzed: string;
}

export interface SkimmerConfig {
  openaiApiKey: string;
  anthropicApiKey?: string;
  meilisearchUrl?: string;
  meilisearchApiKey?: string;
  dataServiceUrl: string;
  contentStoreServiceUrl: string;
  dataServiceApiKey: string;
  webhookSecret: string;
  jwtSecret: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface ProcessingContext {
  fileId: string;
  userId: string;
  startTime: number;
  retryCount: number;
}