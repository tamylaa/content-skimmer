// Abstract interface for search engine providers

import { SearchDocument } from '../types';

export abstract class SearchEngine {
  abstract indexDocument(document: SearchDocument): Promise<void>;
  abstract deleteDocument(documentId: string): Promise<void>;
  abstract searchDocuments(query: string, filters?: object): Promise<SearchDocument[]>;
  abstract bulkIndex(documents: SearchDocument[]): Promise<void>;
}