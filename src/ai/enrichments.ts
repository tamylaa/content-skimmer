// Enhanced enrichment modules for extracting entities, topics, and advanced features

export interface EntityExtractionResult {
  people: string[];
  organizations: string[];
  locations: string[];
  dates: string[];
  amounts: string[];
}

export interface TopicAnalysisResult {
  primaryTopics: string[];
  secondaryTopics: string[];
  categories: string[];
  keywords: string[];
}

export interface ContentEnrichment {
  entities: EntityExtractionResult;
  topics: TopicAnalysisResult;
  sentiment: 'positive' | 'negative' | 'neutral';
  language: string;
  readabilityScore: number;
  contentType: string;
  extractedMetadata: Record<string, any>;
}

export async function extractEntities(text: string): Promise<string[]> {
  // Enhanced entity extraction using regex patterns and AI
  const entities = new Set<string>();
  
  // Simple regex patterns for demonstration - in production, use AI
  const patterns = {
    people: /(?:Mr\.|Mrs\.|Dr\.|Ms\.)\s+[A-Z][a-z]+\s+[A-Z][a-z]+/g,
    organizations: /(?:Inc\.|Corp\.|LLC|Ltd\.|Company|Corporation)\s*$/gm,
    locations: /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:City|State|Country|Street|Avenue|Road|Boulevard))\b/g,
    emails: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    phones: /(?:\+\d{1,3}\s?)?(?:\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}/g
  };

  Object.values(patterns).forEach(pattern => {
    const matches = text.match(pattern) || [];
    matches.forEach(match => entities.add(match.trim()));
  });

  return Array.from(entities);
}

export async function extractTopics(text: string): Promise<string[]> {
  // Enhanced topic extraction using keyword analysis and AI
  const topics = new Set<string>();
  
  // Business/finance keywords
  const businessKeywords = ['revenue', 'profit', 'investment', 'market', 'strategy', 'financial', 'budget', 'analysis', 'growth', 'performance'];
  const techKeywords = ['technology', 'software', 'digital', 'innovation', 'platform', 'automation', 'data', 'analytics', 'cloud', 'AI'];
  const operationalKeywords = ['process', 'operation', 'management', 'workflow', 'efficiency', 'optimization', 'quality', 'compliance'];

  const lowerText = text.toLowerCase();
  
  [businessKeywords, techKeywords, operationalKeywords].forEach((keywords, index) => {
    const categories = ['business', 'technology', 'operations'];
    const matches = keywords.filter(keyword => lowerText.includes(keyword));
    if (matches.length > 0) {
      topics.add(categories[index]);
      matches.forEach(match => topics.add(match));
    }
  });

  return Array.from(topics);
}

export async function performFullEnrichment(text: string, mimeType: string): Promise<ContentEnrichment> {
  const entities = await extractEntities(text);
  const topics = await extractTopics(text);
  
  return {
    entities: {
      people: entities.filter(e => /(?:Mr\.|Mrs\.|Dr\.|Ms\.)\s+[A-Z]/.test(e)),
      organizations: entities.filter(e => /(?:Inc\.|Corp\.|LLC|Ltd\.)/.test(e)),
      locations: entities.filter(e => /(?:City|State|Country|Street|Avenue|Road|Boulevard)/.test(e)),
      dates: extractDates(text),
      amounts: extractAmounts(text)
    },
    topics: {
      primaryTopics: topics.slice(0, 3),
      secondaryTopics: topics.slice(3, 8),
      categories: categorizeContent(text, mimeType),
      keywords: extractKeywords(text)
    },
    sentiment: analyzeSentiment(text),
    language: detectLanguage(text),
    readabilityScore: calculateReadability(text),
    contentType: determineContentType(text, mimeType),
    extractedMetadata: extractMetadata(text, mimeType)
  };
}

function extractDates(text: string): string[] {
  const datePattern = /\b(?:\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/gi;
  return text.match(datePattern) || [];
}

function extractAmounts(text: string): string[] {
  const amountPattern = /\$[\d,]+(?:\.\d{2})?|\b\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:dollars?|USD|EUR|GBP)\b/gi;
  return text.match(amountPattern) || [];
}

function categorizeContent(text: string, mimeType: string): string[] {
  const categories = [];
  const lowerText = text.toLowerCase();
  
  if (mimeType.includes('pdf') || lowerText.includes('report') || lowerText.includes('analysis')) {
    categories.push('document');
  }
  if (lowerText.includes('financial') || lowerText.includes('budget') || lowerText.includes('revenue')) {
    categories.push('financial');
  }
  if (lowerText.includes('strategy') || lowerText.includes('plan') || lowerText.includes('roadmap')) {
    categories.push('strategic');
  }
  
  return categories;
}

function extractKeywords(text: string): string[] {
  // Simple keyword extraction based on frequency and importance
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !isStopWord(word));
    
  const frequency = new Map<string, number>();
  words.forEach(word => {
    frequency.set(word, (frequency.get(word) || 0) + 1);
  });
  
  return Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

function isStopWord(word: string): boolean {
  const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'this', 'that', 'these', 'those', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'cannot', 'have', 'has', 'had', 'been', 'being', 'are', 'is', 'was', 'were', 'am'];
  return stopWords.includes(word);
}

function analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  // Simple sentiment analysis based on positive/negative word counts
  const positiveWords = ['good', 'great', 'excellent', 'positive', 'success', 'growth', 'improve', 'increase', 'profit', 'benefit'];
  const negativeWords = ['bad', 'poor', 'negative', 'loss', 'decrease', 'decline', 'problem', 'issue', 'concern', 'risk'];
  
  const lowerText = text.toLowerCase();
  const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
  const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;
  
  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

function detectLanguage(text: string): string {
  // Simple language detection - in production, use a proper language detection library
  const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
  const spanishWords = ['el', 'la', 'y', 'o', 'pero', 'en', 'de', 'con', 'por', 'para'];
  const frenchWords = ['le', 'la', 'et', 'ou', 'mais', 'en', 'de', 'avec', 'par', 'pour'];
  
  const lowerText = text.toLowerCase();
  const englishCount = englishWords.filter(word => lowerText.includes(word)).length;
  const spanishCount = spanishWords.filter(word => lowerText.includes(word)).length;
  const frenchCount = frenchWords.filter(word => lowerText.includes(word)).length;
  
  const max = Math.max(englishCount, spanishCount, frenchCount);
  if (max === englishCount) return 'en';
  if (max === spanishCount) return 'es';
  if (max === frenchCount) return 'fr';
  return 'unknown';
}

function calculateReadability(text: string): number {
  // Simple Flesch Reading Ease approximation
  const sentences = text.split(/[.!?]+/).length;
  const words = text.split(/\s+/).length;
  const syllables = text.split(/[aeiouAEIOU]/).length;
  
  if (sentences === 0 || words === 0) return 0;
  
  const avgWordsPerSentence = words / sentences;
  const avgSyllablesPerWord = syllables / words;
  
  return Math.max(0, Math.min(100, 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord)));
}

function determineContentType(text: string, mimeType: string): string {
  if (mimeType.includes('pdf')) return 'document';
  if (mimeType.includes('image')) return 'image';
  if (mimeType.includes('text')) return 'text';
  
  const lowerText = text.toLowerCase();
  if (lowerText.includes('report') || lowerText.includes('analysis')) return 'report';
  if (lowerText.includes('contract') || lowerText.includes('agreement')) return 'legal';
  if (lowerText.includes('invoice') || lowerText.includes('receipt')) return 'financial';
  
  return 'general';
}

function extractMetadata(text: string, mimeType: string): Record<string, any> {
  return {
    wordCount: text.split(/\s+/).length,
    characterCount: text.length,
    paragraphCount: text.split(/\n\s*\n/).length,
    mimeType,
    extractedAt: new Date().toISOString(),
    hasStructuredData: /\{|\[|</.test(text),
    hasNumericData: /\d+/.test(text),
    hasUrls: /https?:\/\//.test(text),
    hasEmails: /@.*\.(com|org|net|edu|gov)/.test(text)
  };
}
