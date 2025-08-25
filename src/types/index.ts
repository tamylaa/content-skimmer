// Core type definitions for the content-skimmer service
// Using shared types for consistency across services

// ====================
// Shared Types (replicated for now until proper package is set up)
// ====================

export interface FileMetadata {
  id: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  owner_id: string;
  storage_path: string;
  is_public: boolean;
  category?: string;
  checksum?: string;
  last_accessed_at?: string;
  download_count: number;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';
  processing_started_at?: string;
  processing_completed_at?: string;
  analysis_result?: string; // JSON string
  analysis_summary?: string;
  content_type_detected?: string;
  extraction_status?: 'success' | 'failed' | 'partial';
  skimmer_job_id?: string;
  callback_attempts: number;
  last_callback_at?: string;
  created_at: string;
  updated_at: string;
}

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
  enrichment: Record<string, any>;
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
  // Common config
  environment: 'development' | 'staging' | 'production';
  serviceName: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  
  // Authentication
  authJwtSecret: string;
  
  // Service URLs
  dataServiceUrl: string;
  contentStoreServiceUrl: string;
  authServiceUrl: string;
  meilisearchUrl: string;
  
  // API Keys
  dataServiceApiKey: string;
  meilisearchApiKey: string;
  openaiApiKey: string;
  anthropicApiKey: string;
  
  // Webhooks
  webhookSecret: string;
  
  // CORS
  corsOrigins: string;
  
  // File handling
  maxFileSize: number;
  allowedFileTypes: string;
}

// ====================
// Service-Specific Types
// ====================

export interface ProcessingContext {
  fileId: string;
  userId: string;
  startTime: number;
  retryCount: number;
}

export interface CostReport {
  totalTokensUsed: number;
  totalCost: number;
  breakdown: {
    openai: { tokens: number; cost: number };
    anthropic: { tokens: number; cost: number };
  };
  period: {
    start: string;
    end: string;
  };
}

export interface QueueStatus {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  retrying: number;
}