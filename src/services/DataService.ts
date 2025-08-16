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
}