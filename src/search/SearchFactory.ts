// Factory for creating search engine providers

import { SearchEngine } from './SearchEngine';
import { MeilisearchProvider } from './MeilisearchProvider';
import { VectorizeProvider } from './VectorizeProvider';
import { SkimmerConfig } from '../types';

export class SearchFactory {
  static createSearchEngine(config: SkimmerConfig, env: any): SearchEngine {
    if (config.meilisearchUrl && config.meilisearchApiKey) {
      return new MeilisearchProvider(config.meilisearchUrl, config.meilisearchApiKey);
    }
    
    if (env.VECTORIZE) {
      return new VectorizeProvider(env.VECTORIZE);
    }

    throw new Error('No search engine configuration found');
  }

  static createAllSearchEngines(config: SkimmerConfig, env: any): SearchEngine[] {
    const engines: SearchEngine[] = [];

    if (config.meilisearchUrl && config.meilisearchApiKey) {
      engines.push(new MeilisearchProvider(config.meilisearchUrl, config.meilisearchApiKey));
    }

    if (env.VECTORIZE) {
      engines.push(new VectorizeProvider(env.VECTORIZE));
    }

    return engines;
  }
}