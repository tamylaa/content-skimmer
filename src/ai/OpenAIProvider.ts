// OpenAI implementation of AI provider

import { AIProvider, AIAnalysisResult } from './AIProvider';

export class OpenAIProvider extends AIProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
  }

  async analyzeContent(content: string, mimeType: string): Promise<AIAnalysisResult> {
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
          content: `Analyze this content and return a JSON object with:
            - summary: A concise 2-3 sentence summary
            - entities: Array of people, places, organizations mentioned
            - topics: Array of main topics/categories
            - language: Detected language code
            - sentiment: positive/negative/neutral
            - enrichment: Additional metadata as object`
        }, {
          role: 'user',
          content: content.substring(0, 16000) // Limit content size
        }],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const result = await response.json();
    const analysisText = (result as any).choices[0]?.message?.content;
    
    try {
      return JSON.parse(analysisText);
    } catch (e) {
      // Fallback if JSON parsing fails
      return {
        summary: analysisText || 'Analysis completed',
        entities: [],
        topics: [],
        language: 'unknown',
        sentiment: 'neutral',
        enrichment: {}
      };
    }
  }

  async extractText(buffer: ArrayBuffer, mimeType: string): Promise<string> {
    // For text files, convert directly
    if (mimeType.startsWith('text/')) {
      return new TextDecoder().decode(buffer);
    }

    // For other formats, you would integrate with PDF parsers, OCR, etc.
    // For now, return a placeholder
    return `[Text extraction not implemented for ${mimeType}]`;
  }

  isSupported(mimeType: string): boolean {
    const supportedTypes = [
      'text/plain',
      'text/markdown',
      'text/html',
      'application/json',
      'text/csv'
    ];
    return supportedTypes.includes(mimeType);
  }
}