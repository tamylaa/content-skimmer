// Meilisearch implementation of search engine

import { SearchEngine } from './SearchEngine.js';
import { SearchDocument } from '../types/index.js';

/**
 * MeilisearchProvider now calls the Meilisearch Cloudflare Worker gateway
 * instead of talking to Meili directly with an admin key. This centralizes
 * auth and ensures only the worker can write to the index.
 */
export class MeilisearchProvider extends SearchEngine {
  private workerUrl: string;
  private serviceToken?: string;

  constructor(workerUrl: string, serviceToken?: string) {
    super();
    this.workerUrl = workerUrl.replace(/\/$/, '');
    this.serviceToken = serviceToken;
  }

  private authHeaders() {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.serviceToken) headers['Authorization'] = `Bearer ${this.serviceToken}`;
    return headers;
  }

  async indexDocument(document: SearchDocument): Promise<void> {
    // Ensure compatibility with gateway user isolation (expects user_id field)
    const gatewayDocument = {
      ...document,
      user_id: document.userId // Gateway expects user_id instead of userId
    };

    const response = await fetch(`${this.workerUrl}/documents`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify([gatewayDocument])
    });

    if (!response.ok) {
      throw new Error(`Failed to index document via worker: ${response.status} ${response.statusText}`);
    }
  }

  async deleteDocument(documentId: string): Promise<void> {
    const response = await fetch(`${this.workerUrl}/documents`, {
      method: 'DELETE',
      headers: this.authHeaders(),
      body: JSON.stringify({ ids: [documentId] })
    });

    if (!response.ok) {
      throw new Error(`Failed to delete document via worker: ${response.status} ${response.statusText}`);
    }
  }

  async searchDocuments(query: string, filters?: object): Promise<SearchDocument[]> {
    const searchParams = new URLSearchParams({ q: query });
    if (filters) searchParams.set('filter', typeof filters === 'string' ? (filters as any) : JSON.stringify(filters));

    const url = `${this.workerUrl}/search?${searchParams.toString()}`;
    const response = await fetch(url, { headers: this.authHeaders() });

    if (!response.ok) {
      throw new Error(`Failed to search via worker: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    // Worker returns Meilisearch search response; normalize to hits array if present
    return (result as any).hits || (result as any).results || [];
  }

  async bulkIndex(documents: SearchDocument[]): Promise<void> {
    // Ensure compatibility with gateway user isolation (expects user_id field)
    const gatewayDocuments = documents.map(document => ({
      ...document,
      user_id: document.userId // Gateway expects user_id instead of userId
    }));

    const response = await fetch(`${this.workerUrl}/documents`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify(gatewayDocuments)
    });

    if (!response.ok) {
      throw new Error(`Failed to bulk index via worker: ${response.status} ${response.statusText}`);
    }
  }
}