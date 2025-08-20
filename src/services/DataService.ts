// Service for interacting with the data-service API

import { AnalysisResult } from '../types';

export class DataService {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async getFileMetadata(fileId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/files/${fileId}/metadata`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get file metadata: ${response.statusText}`);
    }

    return response.json();
  }

  async saveAnalysisResults(result: AnalysisResult): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/files/${result.fileId}/analysis-results`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(result)
    });

    if (!response.ok) {
      throw new Error(`Failed to save analysis results: ${response.statusText}`);
    }
  }

  async updateFileStatus(fileId: string, status: string, error?: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/files/${fileId}/status`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status, error })
    });

    if (!response.ok) {
      throw new Error(`Failed to update file status: ${response.statusText}`);
    }
  }

  async deleteSearchIndex(fileId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/files/${fileId}/search-index`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to delete search index: ${response.statusText}`);
    }
  }

  /**
   * Send webhook callback to data-service when processing completes
   */
  async sendProcessingCallback(fileId: string, jobId: string, status: 'completed' | 'failed', result?: any, error?: string): Promise<void> {
    const payload = {
      fileId,
      jobId,
      status,
      result,
      error,
      timestamp: new Date().toISOString()
    };

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
  }
}