// Cost optimization service for AI processing

export interface CostOptimizationConfig {
  maxTokensPerRequest: number;
  enableCaching: boolean;
  useBasicEnrichmentFirst: boolean;
  aiProcessingThresholds: {
    fileSizeKB: number;
    contentLength: number;
    priority: 'low' | 'medium' | 'high';
  };
  costLimits: {
    dailyBudgetUSD: number;
    maxCostPerFile: number;
  };
}

export interface ProcessingDecision {
  useAI: boolean;
  strategy: 'basic' | 'ai-light' | 'ai-full' | 'cached';
  estimatedCost: number;
  reasoning: string;
  contentPreview: string;
}

export class CostOptimizationService {
  private config: CostOptimizationConfig;
  private dailySpend = 0;
  private lastResetDate = new Date().toDateString();
  private cache = new Map<string, any>();

  constructor(config: Partial<CostOptimizationConfig> = {}) {
    this.config = {
      maxTokensPerRequest: 4000, // Limit token usage
      enableCaching: true,
      useBasicEnrichmentFirst: true,
      aiProcessingThresholds: {
        fileSizeKB: 100, // Only use AI for files < 100KB by default
        contentLength: 10000, // Or content < 10k chars
        priority: 'medium'
      },
      costLimits: {
        dailyBudgetUSD: 50, // Daily budget limit
        maxCostPerFile: 0.25 // Max cost per file
      },
      ...config
    };
  }

  async shouldUseAI(
    content: string, 
    fileSize: number, 
    mimeType: string,
    priority: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<ProcessingDecision> {
    // Reset daily spend if new day
    this.resetDailySpendIfNeeded();

    // Check cache first
    const cacheKey = this.generateCacheKey(content, mimeType);
    if (this.config.enableCaching && this.cache.has(cacheKey)) {
      return {
        useAI: false,
        strategy: 'cached',
        estimatedCost: 0,
        reasoning: 'Content found in cache',
        contentPreview: content.substring(0, 100)
      };
    }

    // Check budget limits
    if (this.dailySpend >= this.config.costLimits.dailyBudgetUSD) {
      return {
        useAI: false,
        strategy: 'basic',
        estimatedCost: 0,
        reasoning: 'Daily budget exceeded',
        contentPreview: content.substring(0, 100)
      };
    }

    // Estimate cost
    const estimatedCost = this.estimateOpenAICost(content);
    if (estimatedCost > this.config.costLimits.maxCostPerFile) {
      return {
        useAI: false,
        strategy: 'basic',
        estimatedCost,
        reasoning: `Estimated cost $${estimatedCost.toFixed(4)} exceeds per-file limit`,
        contentPreview: content.substring(0, 100)
      };
    }

    // Check file size and content thresholds
    const fileSizeKB = fileSize / 1024;
    if (fileSizeKB > this.config.aiProcessingThresholds.fileSizeKB && priority !== 'high') {
      return {
        useAI: false,
        strategy: 'basic',
        estimatedCost,
        reasoning: `File size ${fileSizeKB.toFixed(1)}KB exceeds threshold`,
        contentPreview: content.substring(0, 100)
      };
    }

    if (content.length > this.config.aiProcessingThresholds.contentLength && priority !== 'high') {
      return {
        useAI: true,
        strategy: 'ai-light',
        estimatedCost: this.estimateOpenAICost(content.substring(0, this.config.maxTokensPerRequest * 3)),
        reasoning: 'Content truncated for cost optimization',
        contentPreview: content.substring(0, 100)
      };
    }

    // Use AI for high-value content
    if (this.isHighValueContent(content, mimeType) || priority === 'high') {
      return {
        useAI: true,
        strategy: 'ai-full',
        estimatedCost,
        reasoning: 'High-value content warrants AI processing',
        contentPreview: content.substring(0, 100)
      };
    }

    // Default to basic enrichment with light AI
    return {
      useAI: true,
      strategy: 'ai-light',
      estimatedCost: this.estimateOpenAICost(content.substring(0, this.config.maxTokensPerRequest * 3)),
      reasoning: 'Light AI processing for cost efficiency',
      contentPreview: content.substring(0, 100)
    };
  }

  private estimateOpenAICost(content: string): number {
    // GPT-4 pricing: ~$0.03 per 1K tokens input, ~$0.06 per 1K tokens output
    const inputTokens = Math.ceil(content.length / 3); // Rough estimate: 3 chars per token
    const outputTokens = 300; // Estimated output tokens for summary
    
    const inputCost = (inputTokens / 1000) * 0.03;
    const outputCost = (outputTokens / 1000) * 0.06;
    
    return inputCost + outputCost;
  }

  private isHighValueContent(content: string, mimeType: string): boolean {
    const lowerContent = content.toLowerCase();
    
    // Business/financial documents
    if (mimeType.includes('pdf') || mimeType.includes('word')) {
      const businessKeywords = ['contract', 'agreement', 'proposal', 'financial', 'revenue', 'budget', 'strategy'];
      if (businessKeywords.some(keyword => lowerContent.includes(keyword))) {
        return true;
      }
    }

    // Structured data
    if (mimeType.includes('json') || mimeType.includes('xml')) {
      return true;
    }

    // Large text documents with technical content
    if (content.length > 5000 && /\b(analysis|report|research|technical|specifications?)\b/i.test(content)) {
      return true;
    }

    return false;
  }

  private generateCacheKey(content: string, mimeType: string): string {
    // Simple hash for caching (in production, use a proper hash function)
    const hash = this.simpleHash(content + mimeType);
    return `content_${hash}_${mimeType}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private resetDailySpendIfNeeded(): void {
    const today = new Date().toDateString();
    if (this.lastResetDate !== today) {
      this.dailySpend = 0;
      this.lastResetDate = today;
    }
  }

  recordAIUsage(cost: number): void {
    this.dailySpend += cost;
  }

  cacheResult(content: string, mimeType: string, result: any): void {
    if (!this.config.enableCaching) return;
    
    const cacheKey = this.generateCacheKey(content, mimeType);
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now(),
      cost: 0 // Cached results have no cost
    });

    // Simple cache cleanup - keep only 1000 most recent entries
    if (this.cache.size > 1000) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }

  getCachedResult(content: string, mimeType: string): any | null {
    if (!this.config.enableCaching) return null;
    
    const cacheKey = this.generateCacheKey(content, mimeType);
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) { // 24 hour cache
      return cached.result;
    }
    
    return null;
  }

  getSpendingReport(): {
    dailySpend: number;
    budgetRemaining: number;
    costPerFile: number;
    totalProcessed: number;
    cacheHitRate: number;
  } {
    return {
      dailySpend: this.dailySpend,
      budgetRemaining: this.config.costLimits.dailyBudgetUSD - this.dailySpend,
      costPerFile: this.dailySpend / Math.max(1, this.cache.size),
      totalProcessed: this.cache.size,
      cacheHitRate: 0.15 // Placeholder - would track in production
    };
  }

  optimizeContentForAI(content: string, strategy: 'ai-light' | 'ai-full'): string {
    if (strategy === 'ai-light') {
      // Extract key sections for light processing
      const paragraphs = content.split('\n\n');
      const keyParagraphs = paragraphs
        .filter(p => p.length > 50) // Skip short paragraphs
        .slice(0, 5) // Take first 5 meaningful paragraphs
        .join('\n\n');
      
      return keyParagraphs.substring(0, this.config.maxTokensPerRequest * 3);
    }
    
    return content.substring(0, this.config.maxTokensPerRequest * 4); // Full but limited
  }
}

// Cost optimization strategies
export const COST_STRATEGIES = {
  DEVELOPMENT: {
    maxTokensPerRequest: 2000,
    enableCaching: true,
    useBasicEnrichmentFirst: true,
    aiProcessingThresholds: {
      fileSizeKB: 50,
      contentLength: 5000,
      priority: 'medium' as const
    },
    costLimits: {
      dailyBudgetUSD: 10,
      maxCostPerFile: 0.10
    }
  },
  PRODUCTION: {
    maxTokensPerRequest: 8000,
    enableCaching: true,
    useBasicEnrichmentFirst: true,
    aiProcessingThresholds: {
      fileSizeKB: 200,
      contentLength: 20000,
      priority: 'medium' as const
    },
    costLimits: {
      dailyBudgetUSD: 100,
      maxCostPerFile: 0.50
    }
  },
  HIGH_VOLUME: {
    maxTokensPerRequest: 4000,
    enableCaching: true,
    useBasicEnrichmentFirst: true,
    aiProcessingThresholds: {
      fileSizeKB: 100,
      contentLength: 10000,
      priority: 'low' as const
    },
    costLimits: {
      dailyBudgetUSD: 200,
      maxCostPerFile: 0.25
    }
  }
};
