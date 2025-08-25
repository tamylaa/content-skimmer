// Service for interacting with the data-service API

import { AnalysisResult } from '../types/index.js';
import { circuitBreakerManager } from '../utils/CircuitBreaker.js';

export class DataService {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async getFileMetadata(fileId: string): Promise<any> {
    const breaker = circuitBreakerManager.getBreaker('data-service-metadata');
    
    return breaker.execute(
      async () => {
        const response = await fetch(`${this.baseUrl}/files/${fileId}`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to get file metadata: ${response.statusText}`);
        }

        const result = await response.json();
        return result.success ? result.data : result;
      },
      async () => {
        // Fallback metadata
        return {
          fileId,
          filename: 'unknown-file',
          mimeType: 'application/octet-stream',
          uploadedAt: new Date().toISOString(),
          fallback: true
        };
      }
    );
  }

  async saveAnalysisResults(result: AnalysisResult): Promise<void> {
    const breaker = circuitBreakerManager.getBreaker('data-service-analysis');
    
    return breaker.execute(
      async () => {
        const response = await fetch(`${this.baseUrl}/files/${result.fileId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            analysis_result: JSON.stringify(result),
            analysis_summary: result.summary,
            processing_status: result.analysisStatus === 'completed' ? 'completed' : 'failed',
            processing_completed_at: new Date().toISOString(),
            extraction_status: result.error ? 'failed' : 'success'
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to save analysis results: ${response.statusText}`);
        }
      },
      async () => {
        // Fallback: log the failure for later retry
        console.warn(`Failed to save analysis results for ${result.fileId}, will retry later`);
      }
    );
  }

  async updateFileStatus(fileId: string, status: string, error?: string): Promise<void> {
    const breaker = circuitBreakerManager.getBreaker('data-service-status');
    
    return breaker.execute(
      async () => {
        const response = await fetch(`${this.baseUrl}/files/${fileId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            processing_status: status,
            ...(error && { error }),
            last_callback_at: new Date().toISOString()
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to update file status: ${response.statusText}`);
        }
      },
      async () => {
        // Fallback: log status update for later retry
        console.warn(`Failed to update status for ${fileId} to ${status}`);
      }
    );
  }

  async deleteSearchIndex(fileId: string): Promise<void> {
    // This method is deprecated - search index is now managed by meilisearch service
    // Keep for backward compatibility but make it a no-op
    console.log(`Search index deletion for ${fileId} is now handled by meilisearch service`);
    return Promise.resolve();
  }

  /**
   * Send webhook callback to data-service when processing completes
   */
  async sendProcessingCallback(fileId: string, jobId: string, status: 'completed' | 'failed', result?: any, error?: string): Promise<void> {
    const breaker = circuitBreakerManager.getBreaker('data-service-webhook');
    
    const payload = {
      fileId,
      jobId,
      status,
      result,
      error,
      timestamp: new Date().toISOString()
    };

    return breaker.execute(
      async () => {
        const response = await fetch(`${this.baseUrl}/webhook/skimmer-complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Secret': 'default-webhook-secret' // Should match data-service expectation
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Webhook callback failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        console.log(`Webhook callback sent successfully for file ${fileId} with status ${status}`);
      },
      async () => {
        console.error(`Failed to send webhook callback for ${fileId}, critical data may be lost`);
        // In production, this should be queued for retry
        throw new Error(`Webhook callback failed for ${fileId} - this is critical`);
      }
    );
  }
}