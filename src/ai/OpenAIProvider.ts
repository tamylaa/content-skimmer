// OpenAI implementation of AI provider with cost optimization

import { AIProvider, AIAnalysisResult } from './AIProvider';
import { TextExtractionService } from './TextExtractionService';
import { performFullEnrichment } from './enrichments';
import { CostOptimizationService, COST_STRATEGIES } from './CostOptimizationService';

export class OpenAIProvider extends AIProvider {
  private apiKey: string;
  private textExtractor: TextExtractionService;
  private costOptimizer: CostOptimizationService;

  constructor(apiKey: string, environment: 'development' | 'production' | 'high_volume' = 'production') {
    super();
    this.apiKey = apiKey;
    this.textExtractor = new TextExtractionService();
    
    // Initialize cost optimization based on environment
    const strategy = environment === 'development' ? COST_STRATEGIES.DEVELOPMENT :
                    environment === 'high_volume' ? COST_STRATEGIES.HIGH_VOLUME :
                    COST_STRATEGIES.PRODUCTION;
    
    this.costOptimizer = new CostOptimizationService(strategy);
  }

  async analyzeContent(content: string, mimeType: string, priority: 'low' | 'medium' | 'high' = 'medium'): Promise<AIAnalysisResult> {
    try {
      // Check if we have cached result first
      const cachedResult = this.costOptimizer.getCachedResult(content, mimeType);
      if (cachedResult) {
        console.log('Using cached AI result for content');
        return cachedResult;
      }

      // Determine if we should use AI based on cost optimization
      const decision = await this.costOptimizer.shouldUseAI(
        content, 
        content.length, 
        mimeType, 
        priority
      );

      console.log(`AI Processing Decision: ${decision.strategy} - ${decision.reasoning} (Est. cost: $${decision.estimatedCost.toFixed(4)})`);

      // Perform enhanced enrichment (always - it's free)
      const enrichment = await performFullEnrichment(content, mimeType);
      
      let aiAnalysis: any = null;
      
      if (decision.useAI && decision.strategy !== 'cached') {
        // Optimize content based on strategy
        const optimizedContent = this.costOptimizer.optimizeContentForAI(content, decision.strategy as any);
        
        // Get AI-powered summary and analysis
        aiAnalysis = await this.callOpenAI(optimizedContent, decision.strategy);
        
        // Record actual cost
        this.costOptimizer.recordAIUsage(decision.estimatedCost);
      }

      const result: AIAnalysisResult = {
        summary: aiAnalysis?.summary || this.generateFallbackSummary(content),
        entities: enrichment.entities.people.concat(
          enrichment.entities.organizations,
          enrichment.entities.locations
        ),
        topics: enrichment.topics.primaryTopics.concat(enrichment.topics.secondaryTopics),
        language: enrichment.language,
        sentiment: enrichment.sentiment,
        enrichment: {
          readabilityScore: enrichment.readabilityScore,
          contentType: enrichment.contentType,
          extractedMetadata: enrichment.extractedMetadata,
          keywords: enrichment.topics.keywords,
          categories: enrichment.topics.categories,
          entityBreakdown: enrichment.entities,
          fullTopicAnalysis: enrichment.topics,
          costOptimization: {
            strategy: decision.strategy,
            estimatedCost: decision.estimatedCost,
            usedAI: decision.useAI,
            reasoning: decision.reasoning
          }
        }
      };

      // Cache the result for future use
      this.costOptimizer.cacheResult(content, mimeType, result);
      
      return result;
      
    } catch (error) {
      console.error('OpenAI analysis failed:', error);
      // Fallback to basic enrichment only
      const basicEnrichment = await performFullEnrichment(content, mimeType);
      
      return {
        summary: this.generateFallbackSummary(content),
        entities: basicEnrichment.entities.people.concat(
          basicEnrichment.entities.organizations,
          basicEnrichment.entities.locations
        ),
        topics: basicEnrichment.topics.primaryTopics,
        language: basicEnrichment.language,
        sentiment: basicEnrichment.sentiment,
        enrichment: {
          contentType: basicEnrichment.contentType,
          extractedMetadata: basicEnrichment.extractedMetadata,
          fallbackReason: 'OpenAI API unavailable',
          costOptimization: {
            strategy: 'basic',
            estimatedCost: 0,
            usedAI: false,
            reasoning: 'API error fallback'
          }
        }
      };
    }
  }

  private async callOpenAI(content: string, strategy: string): Promise<{ summary: string; analysis?: any }> {
    const systemPrompt = strategy === 'ai-light' 
      ? `You are an expert content analyzer. Provide a concise 2-3 sentence summary of the content. Focus on key facts and main points only.`
      : `You are an expert content analyzer. Analyze the provided content and return a JSON object with:
         - summary: A comprehensive 3-4 sentence summary
         - keyInsights: Array of main insights or findings
         - actionItems: Array of any action items mentioned
         - criticalInfo: Any time-sensitive or critical information
         Focus on business value and actionable insights.`;

    const maxTokens = strategy === 'ai-light' ? 150 : 1000;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{
          role: 'system',
          content: systemPrompt
        }, {
          role: 'user',
          content: content
        }],
        temperature: 0.3,
        max_tokens: maxTokens
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const analysisText = (result as any).choices[0]?.message?.content;
    
    if (strategy === 'ai-light') {
      return { summary: analysisText || 'Analysis completed' };
    }
    
    try {
      return JSON.parse(analysisText);
    } catch (e) {
      // If JSON parsing fails, treat the response as a summary
      return {
        summary: analysisText || 'Analysis completed',
        analysis: { parseError: true }
      };
    }
  }

  getCostReport(): any {
    return this.costOptimizer.getSpendingReport();
  }

  private generateFallbackSummary(content: string): string {
    // Generate a basic summary when AI is unavailable
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const firstSentences = sentences.slice(0, 3).map(s => s.trim()).join('. ');
    
    if (firstSentences.length > 300) {
      return firstSentences.substring(0, 297) + '...';
    }
    
    return firstSentences || 'Content analysis completed using basic extraction methods.';
  }

  async extractText(buffer: ArrayBuffer, mimeType: string, filename?: string): Promise<string> {
    if (!filename) {
      // Generate filename from mime type for extraction service
      const ext = this.getExtensionFromMimeType(mimeType);
      filename = `file.${ext}`;
    }

    const result = await this.textExtractor.extractText(buffer, filename, mimeType);
    
    if (result.error) {
      throw new Error(`Text extraction failed: ${result.error}`);
    }
    
    return result.text;
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'text/plain': 'txt',
      'text/markdown': 'md',
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'video/mp4': 'mp4',
      'audio/mpeg': 'mp3'
    };
    
    return mimeToExt[mimeType] || 'bin';
  }

  isSupported(mimeType: string): boolean {
    const supportedTypes = [
      'text/plain',
      'text/markdown',
      'text/html',
      'application/json',
      'text/csv',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/gif',
      'video/mp4',
      'audio/mpeg',
      'audio/wav'
    ];
    return supportedTypes.includes(mimeType);
  }
}