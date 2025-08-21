// Orchestrates AI analysis with fallback providers and cost optimization

import { AIProvider, AIAnalysisResult } from './AIProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { SkimmerConfig } from '../types';

export class AIOrchestrator {
  private providers: AIProvider[];
  private environment: 'development' | 'production' | 'high_volume';

  constructor(config: SkimmerConfig) {
    this.providers = [];
    
    // Determine environment from log level or explicit config
    this.environment = config.logLevel === 'debug' ? 'development' : 'production';
    
    if (config.openaiApiKey) {
      this.providers.push(new OpenAIProvider(config.openaiApiKey, this.environment));
    }
    
    // Add other providers as configured
    // if (config.anthropicApiKey) {
    //   this.providers.push(new AnthropicProvider(config.anthropicApiKey));
    // }
  }

  async analyzeFile(
    buffer: ArrayBuffer, 
    mimeType: string, 
    priority: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<AIAnalysisResult> {
    let lastError: Error | null = null;

    for (const provider of this.providers) {
      try {
        if (!provider.isSupported(mimeType)) {
          continue;
        }

        const text = await provider.extractText(buffer, mimeType);
        
        // Pass priority to the provider for cost optimization
        if (provider instanceof OpenAIProvider) {
          return await provider.analyzeContent(text, mimeType, priority);
        } else {
          return await provider.analyzeContent(text, mimeType);
        }
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

  getCostReport(): any {
    const reports = this.providers
      .filter(p => p instanceof OpenAIProvider)
      .map(p => (p as OpenAIProvider).getCostReport());
    
    return {
      environment: this.environment,
      providers: reports,
      totalDailySpend: reports.reduce((sum, r) => sum + r.dailySpend, 0)
    };
  }

  setEnvironment(env: 'development' | 'production' | 'high_volume'): void {
    this.environment = env;
  }
}