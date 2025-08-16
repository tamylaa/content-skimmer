// Meilisearch implementation of search engine

import { SearchEngine } from './SearchEngine';
import { SearchDocument } from '../types';

export class MeilisearchProvider extends SearchEngine {
  private url: string;
  private apiKey: string;
  private indexName: string;

  constructor(url: string, apiKey: string, indexName: string = 'content') {
    super();
    this.url = url;
    this.apiKey = apiKey;
    this.indexName = indexName;
  }

  async indexDocument(document: SearchDocument): Promise<void> {
    const response = await fetch(`${this.url}/indexes/${this.indexName}/documents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([document])
    });

    if (!response.ok) {
      throw new Error(`Failed to index document: ${response.statusText}`);
    }
  }

  async deleteDocument(documentId: string): Promise<void> {
    const response = await fetch(`${this.url}/indexes/${this.indexName}/documents/${documentId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to delete document: ${response.statusText}`);
    }
  }

  async searchDocuments(query: string, filters?: object): Promise<SearchDocument[]> {
    const searchParams = new URLSearchParams({
      q: query,
      ...(filters && { filter: JSON.stringify(filters) })
    });

    const response = await fetch(`${this.url}/indexes/${this.indexName}/search?${searchParams}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to search documents: ${response.statusText}`);
    }

    const result = await response.json();
    return result.hits || [];
  }

  async bulkIndex(documents: SearchDocument[]): Promise<void> {
    const response = await fetch(`${this.url}/indexes/${this.indexName}/documents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(documents)
    });

    if (!response.ok) {
      throw new Error(`Failed to bulk index documents: ${response.statusText}`);
    }
  }
}