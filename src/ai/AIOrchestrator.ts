// Orchestrates AI analysis with fallback providers

import { AIProvider, AIAnalysisResult } from './AIProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { SkimmerConfig } from '../types';

export class AIOrchestrator {
  private providers: AIProvider[];

  constructor(config: SkimmerConfig) {
    this.providers = [];
    
    if (config.openaiApiKey) {
      this.providers.push(new OpenAIProvider(config.openaiApiKey));
    }
    
    // Add other providers as configured
    // if (config.anthropicApiKey) {
    //   this.providers.push(new AnthropicProvider(config.anthropicApiKey));
    // }
  }

  async analyzeFile(buffer: ArrayBuffer, mimeType: string): Promise<AIAnalysisResult> {
    let lastError: Error | null = null;

    for (const provider of this.providers) {
      try {
        if (!provider.isSupported(mimeType)) {
          continue;
        }

        const text = await provider.extractText(buffer, mimeType);
        return await provider.analyzeContent(text, mimeType);
      } catch (error) {
        lastError = error as Error;
        console.warn(`Provider failed, trying next: ${error}`);
        continue;
      }
    }

    throw new Error(`All AI providers failed. Last error: ${lastError?.message}`);
  }

  hasCompatibleProvider(mimeType: string): boolean {
    return this.providers.some(provider => provider.isSupported(mimeType));
  }
}