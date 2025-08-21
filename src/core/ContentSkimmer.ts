// Main orchestrator for the content skimming process awareness

import { FileRegistrationEvent, AnalysisResult, SearchDocument, SkimmerConfig, ProcessingContext } from '../types';
import { DataService } from '../services/DataService';
import { ContentStoreService } from '../services/ContentStoreService';
import { AIOrchestrator } from '../ai/AIOrchestrator';
import { SearchFactory } from '../search/SearchFactory';
import { EventBus } from '../events/EventBus';
import { RetryQueue } from '../events/RetryQueue';
import { Logger } from '../monitoring/Logger';
import { QueryCaptureService, SessionManager } from '../services/QueryLearningService';
import { D1QueryService } from '../services/D1QueryService';

export class ContentSkimmer {
  private dataService: DataService;
  private contentStoreService: ContentStoreService;
  private aiOrchestrator: AIOrchestrator;
  private searchEngines: any[];
  private eventBus: EventBus;
  private retryQueue: RetryQueue;
  private logger: Logger;
  
  // Query learning components (Phase 1)
  private d1QueryService?: D1QueryService;
  private queryCapture?: QueryCaptureService;
  private sessionManager?: SessionManager;
  private env?: any;

  constructor(config: SkimmerConfig, env: any) {
    this.dataService = new DataService(config.dataServiceUrl, config.dataServiceApiKey);
    this.contentStoreService = new ContentStoreService(config.contentStoreServiceUrl, config.dataServiceApiKey);
    this.aiOrchestrator = new AIOrchestrator(config);
    this.searchEngines = SearchFactory.createAllSearchEngines(config, env);
    this.eventBus = new EventBus();
    this.retryQueue = new RetryQueue();
    this.logger = new Logger(config.logLevel);
    this.env = env;

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.eventBus.on('analysis_completed', async (event) => {
      const { result, context } = event.payload;
      await this.updateSearchIndex(result, context);
    });

    this.eventBus.on('analysis_failed', async (event) => {
      const { error, context } = event.payload;
      await this.handleAnalysisFailure(error, context);
    });
  }

  /**
   * Initialize query learning components (Phase 1)
   */
  private initializeQueryLearningComponents(): void {
    if (!this.env?.QUERY_LEARNING_DB) {
      this.logger.warn('Query learning D1 database not configured');
      return;
    }

    try {
      this.d1QueryService = new D1QueryService(this.env.QUERY_LEARNING_DB);
      this.queryCapture = new QueryCaptureService(this.d1QueryService, this.logger);
      this.sessionManager = new SessionManager(this.d1QueryService);
      
      this.logger.info('Query learning components initialized');
    } catch (error) {
      this.logger.error('Failed to initialize query learning components', {
        error: (error as Error).message
      });
    }
  }

  /**
   * Initialize query learning database schema (admin operation)
   */
  async initializeQueryLearning(): Promise<boolean> {
    if (!this.d1QueryService) {
      this.initializeQueryLearningComponents();
    }

    if (!this.d1QueryService) {
      return false;
    }

    return await this.d1QueryService.initializeSchema();
  }

  async processFile(event: FileRegistrationEvent): Promise<void> {
    const { metricsCollector } = await import('../monitoring/Metrics');
    
    const context: ProcessingContext = {
      fileId: event.fileId,
      userId: event.userId,
      startTime: Date.now(),
      retryCount: 0
    };

    const jobId = `job-${Date.now()}-${event.fileId}`;
    const operationId = `process-${event.fileId}-${Date.now()}`;

    // Start metrics tracking
    metricsCollector.incrementCounter('file.processing.started', { 
      mimeType: event.mimeType,
      userId: event.userId 
    });
    metricsCollector.startTimer(operationId);

    this.logger.info('Starting file processing', { 
      fileId: event.fileId, 
      jobId,
      filename: event.filename,
      mimeType: event.mimeType,
      fileSize: event.fileSize
    });

    try {
      // Update status to processing (using old API for now, webhook will handle final status)
      try {
        await this.dataService.updateFileStatus(event.fileId, 'analyzing');
      } catch (statusError) {
        this.logger.warn('Could not update file status via old API, continuing with processing', {
          fileId: event.fileId,
          error: (statusError as Error).message
        });
      }

      // Check if AI can handle this file type
      if (!this.aiOrchestrator.hasCompatibleProvider(event.mimeType)) {
        const error = `Unsupported file type: ${event.mimeType}`;
        await this.dataService.sendProcessingCallback(event.fileId, jobId, 'failed', null, error);
        
        metricsCollector.incrementCounter('file.processing.failed', { 
          reason: 'unsupported_type',
          mimeType: event.mimeType 
        });
        
        throw new Error(error);
      }

      // Get file content
      const fileBuffer = await this.getFileContent(event);
      metricsCollector.incrementCounter('file.content.downloaded', { 
        mimeType: event.mimeType,
        sizeKB: Math.round(fileBuffer.byteLength / 1024).toString()
      });

      // Perform AI analysis
      const aiResult = await this.aiOrchestrator.analyzeFile(fileBuffer, event.mimeType);
      metricsCollector.incrementCounter('ai.analysis.completed', { 
        mimeType: event.mimeType,
        entitiesFound: aiResult.entities?.length.toString() || '0',
        topicsFound: aiResult.topics?.length.toString() || '0'
      });

      // Prepare analysis result for webhook
      const analysisResult = {
        summary: aiResult.summary,
        contentType: this.determineContentType(event.mimeType, aiResult),
        extractedText: aiResult.summary, // Use summary as extracted text for now
        metadata: {
          pageCount: 1, // Estimate based on file type or size
          wordCount: this.estimateWordCount(aiResult.summary),
          language: aiResult.language || 'en',
          confidence: 0.9, // Default confidence
          processingTime: (Date.now() - context.startTime) / 1000,
          extractionMethod: 'AI Analysis',
          entities: aiResult.entities?.length || 0,
          topics: aiResult.topics?.length || 0,
          sentiment: aiResult.sentiment || 'neutral'
        }
      };

      // Send success webhook callback
      await this.dataService.sendProcessingCallback(event.fileId, jobId, 'completed', analysisResult);

      // Legacy: Save results using old API (if it exists)
      try {
        const legacyResult: AnalysisResult = {
          fileId: event.fileId,
          summary: aiResult.summary,
          entities: aiResult.entities,
          topics: aiResult.topics,
          enrichment: aiResult.enrichment,
          r2References: [],
          analysisStatus: 'completed'
        };
        await this.dataService.saveAnalysisResults(legacyResult);
        await this.dataService.updateFileStatus(event.fileId, 'analyzed');
      } catch (legacyError) {
        this.logger.warn('Legacy API calls failed, but webhook was sent successfully', {
          fileId: event.fileId,
          error: (legacyError as Error).message
        });
      }

      // Emit completion event for search indexing
      await this.eventBus.emit('analysis_completed', { result: analysisResult, context, event });

      const processingTime = metricsCollector.endTimer(operationId, 'file.processing.duration', {
        mimeType: event.mimeType,
        status: 'success'
      });

      metricsCollector.incrementCounter('file.processing.completed', { 
        mimeType: event.mimeType,
        userId: event.userId 
      });

      this.logger.info('File processing completed successfully', {
        fileId: event.fileId,
        jobId,
        processingTimeMs: processingTime,
        entitiesFound: aiResult.entities?.length || 0,
        topicsFound: aiResult.topics?.length || 0
      });

    } catch (error) {
      // Record failure metrics
      const processingTime = metricsCollector.endTimer(operationId, 'file.processing.duration', {
        mimeType: event.mimeType,
        status: 'error'
      });

      metricsCollector.incrementCounter('file.processing.failed', { 
        mimeType: event.mimeType,
        reason: 'processing_error'
      });

      // Send failure webhook callback
      try {
        await this.dataService.sendProcessingCallback(event.fileId, jobId, 'failed', null, (error as Error).message);
      } catch (webhookError) {
        this.logger.error('Failed to send failure webhook', {
          fileId: event.fileId,
          originalError: (error as Error).message,
          webhookError: (webhookError as Error).message
        });
      }

      await this.eventBus.emit('analysis_failed', { error, context, event });
      throw error;
    }
  }

  private determineContentType(mimeType: string, aiResult: any): string {
    if (mimeType.includes('pdf')) return 'document';
    if (mimeType.includes('image')) return 'image';
    if (mimeType.includes('text')) return 'text';
    if (mimeType.includes('application/vnd.openxmlformats') || mimeType.includes('application/msword')) return 'document';
    
    // Use AI result to determine content type if available
    if (aiResult.topics && aiResult.topics.length > 0) {
      const businessTopics = aiResult.topics.filter((topic: any) => 
        topic.includes('business') || topic.includes('financial') || topic.includes('analysis')
      );
      if (businessTopics.length > 0) return 'business-document';
    }
    
    return 'document';
  }

  private estimateWordCount(text: string): number {
    return text ? text.split(/\s+/).length : 0;
  }

  private async getFileContent(event: FileRegistrationEvent): Promise<ArrayBuffer> {
    let signedUrl = event.signedUrl;

    // Get signed URL if not provided
    if (!signedUrl) {
      const urlResponse = await this.contentStoreService.getSignedUrl(event.fileId);
      signedUrl = urlResponse.signedUrl;
    }

    return await this.contentStoreService.downloadFile(signedUrl);
  }

  private async updateSearchIndex(result: AnalysisResult, context: ProcessingContext): Promise<void> {
    const { metricsCollector } = await import('../monitoring/Metrics');
    
    try {
      // Get file metadata for search document
      const metadata = await this.dataService.getFileMetadata(result.fileId);

      const searchDoc: SearchDocument = {
        id: result.fileId,
        title: metadata.filename || 'Untitled',
        summary: result.summary,
        entities: result.entities,
        topics: result.topics,
        userId: context.userId,
        filename: metadata.filename,
        mimeType: metadata.mimeType,
        uploadedAt: metadata.uploadedAt,
        lastAnalyzed: new Date().toISOString()
      };

      // Update all configured search engines
      for (const searchEngine of this.searchEngines) {
        this.retryQueue.addOperation(
          `search_index_${result.fileId}_${searchEngine.constructor.name}`,
          async () => {
            await searchEngine.indexDocument(searchDoc);
            metricsCollector.incrementCounter('search.index.updated', {
              engine: searchEngine.constructor.name,
              fileId: result.fileId
            });
          }
        );
      }

      metricsCollector.incrementCounter('search.index.queued', {
        fileId: result.fileId,
        engines: this.searchEngines.length.toString()
      });

      this.logger.info('Search index update queued', {
        fileId: result.fileId,
        searchEngines: this.searchEngines.length
      });

    } catch (error) {
      metricsCollector.incrementCounter('search.index.failed', {
        fileId: result.fileId,
        reason: 'metadata_fetch_failed'
      });

      this.logger.error('Failed to update search index', {
        fileId: result.fileId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  private async handleAnalysisFailure(error: Error, context: ProcessingContext): Promise<void> {
    this.logger.error('File analysis failed', {
      fileId: context.fileId,
      error: error.message,
      processingTimeMs: Date.now() - context.startTime
    });

    const jobId = `job-${Date.now()}-${context.fileId}`;

    try {
      // Send failure webhook callback
      await this.dataService.sendProcessingCallback(context.fileId, jobId, 'failed', null, error.message);
    } catch (webhookError) {
      this.logger.error('Failed to send failure webhook callback', {
        fileId: context.fileId,
        originalError: error.message,
        webhookError: (webhookError as Error).message
      });
    }

    try {
      // Legacy API call
      await this.dataService.updateFileStatus(context.fileId, 'analysis_failed', error.message);
    } catch (updateError) {
      this.logger.error('Failed to update error status via legacy API', {
        fileId: context.fileId,
        originalError: error.message,
        updateError: (updateError as Error).message
      });
    }
  }

  async getQueueStatus(): Promise<any> {
    return {
      retryQueue: this.retryQueue.getQueueStatus(),
      searchEngines: this.searchEngines.length
    };
  }

  async searchContent(query: string, userId: string, engine: string = 'all', limit: number = 20): Promise<SearchDocument[]> {
    const { metricsCollector } = await import('../monitoring/Metrics');
    const operationId = `search-${Date.now()}-${Math.random()}`;
    metricsCollector.startTimer(operationId);

    // Initialize query learning if needed
    if (!this.queryCapture && this.env?.QUERY_LEARNING_DB) {
      this.initializeQueryLearningComponents();
    }

    // Get session for query learning
    let sessionId = '';
    if (this.sessionManager) {
      try {
        sessionId = await this.sessionManager.getOrCreateSession(userId);
      } catch (error) {
        this.logger.warn('Failed to get session for query learning', {
          error: (error as Error).message
        });
      }
    }

    const startTime = Date.now();

    try {
      let results: SearchDocument[] = [];

      if (engine === 'all') {
        // Search all engines and merge results
        const allResults = await Promise.all(
          this.searchEngines.map(async (searchEngine) => {
            try {
              return await searchEngine.searchDocuments(query, { userId });
            } catch (error) {
              this.logger.warn('Search engine failed', {
                engine: searchEngine.constructor.name,
                error: (error as Error).message
              });
              return [];
            }
          })
        );

        // Merge and deduplicate results
        const merged = new Map<string, SearchDocument>();
        allResults.flat().forEach(doc => {
          if (!merged.has(doc.id)) {
            merged.set(doc.id, doc);
          }
        });
        results = Array.from(merged.values());

      } else {
        // Search specific engine
        const targetEngine = this.searchEngines.find(se => 
          se.constructor.name.toLowerCase().includes(engine.toLowerCase())
        );

        if (!targetEngine) {
          throw new Error(`Search engine '${engine}' not found`);
        }

        results = await targetEngine.searchDocuments(query, { userId });
      }

      // Limit results
      results = results.slice(0, limit);

      const responseTime = Date.now() - startTime;

      // Capture query for learning (Phase 1)
      if (this.queryCapture && sessionId) {
        try {
          await this.queryCapture.captureQuery({
            userId,
            sessionId,
            queryText: query,
            searchEngine: engine,
            resultCount: results.length,
            responseTime
          });
        } catch (error) {
          this.logger.warn('Failed to capture query for learning', {
            error: (error as Error).message
          });
        }
      }

      // Track metrics
      const duration = metricsCollector.endTimer(operationId, 'search.duration', {
        engine,
        resultCount: results.length.toString()
      });

      metricsCollector.incrementCounter('search.requests', {
        engine,
        userId
      });

      this.logger.info('Search completed', {
        query,
        engine,
        resultCount: results.length,
        duration,
        queryLearningEnabled: !!this.queryCapture
      });

      return results;

    } catch (error) {
      // Still capture failed queries for learning
      if (this.queryCapture && sessionId) {
        try {
          await this.queryCapture.captureQuery({
            userId,
            sessionId,
            queryText: query,
            searchEngine: engine,
            resultCount: 0,
            responseTime: Date.now() - startTime
          });
        } catch (captureError) {
          this.logger.warn('Failed to capture failed query', {
            error: (captureError as Error).message
          });
        }
      }

      metricsCollector.incrementCounter('search.errors', {
        engine,
        reason: (error as Error).message
      });

      this.logger.error('Search failed', {
        query,
        engine,
        error: (error as Error).message
      });

      throw error;
    }
  }

  async advancedSearch(searchRequest: any, userId: string): Promise<any> {
    const { metricsCollector } = await import('../monitoring/Metrics');
    const operationId = `advanced-search-${Date.now()}-${Math.random()}`;
    metricsCollector.startTimer(operationId);

    try {
      const {
        query,
        filters = {},
        facets = [],
        engine = 'all',
        limit = 20,
        offset = 0,
        sortBy = 'relevance'
      } = searchRequest;

      // Add user filter
      const userFilters = { ...filters, userId };

      let results: SearchDocument[] = [];
      let facetResults: any = {};

      if (engine === 'meilisearch' || engine === 'all') {
        // Use Meilisearch for advanced features
        const meilisearchEngine = this.searchEngines.find(se => 
          se.constructor.name === 'MeilisearchProvider'
        );

        if (meilisearchEngine) {
          const searchParams = {
            q: query,
            filter: this.buildMeilisearchFilter(userFilters),
            facets: facets,
            limit,
            offset,
            sort: sortBy !== 'relevance' ? [sortBy] : undefined
          };

          results = await meilisearchEngine.searchDocuments(query, searchParams);
          
          // Extract facets if requested
          if (facets.length > 0) {
            facetResults = await this.extractFacets(results, facets);
          }
        }
      }

      if (engine === 'vectorize' && results.length === 0) {
        // Fallback to Vectorize for semantic search
        const vectorizeEngine = this.searchEngines.find(se => 
          se.constructor.name === 'VectorizeProvider'
        );

        if (vectorizeEngine) {
          results = await vectorizeEngine.searchDocuments(query, userFilters);
          results = results.slice(offset, offset + limit);
        }
      }

      const response = {
        query,
        filters: userFilters,
        results,
        facets: facetResults,
        total: results.length,
        offset,
        limit,
        engine: engine === 'all' ? this.searchEngines.map(se => se.constructor.name) : engine
      };

      // Track metrics
      const duration = metricsCollector.endTimer(operationId, 'search.advanced.duration', {
        engine,
        resultCount: results.length.toString()
      });

      return response;

    } catch (error) {
      metricsCollector.incrementCounter('search.advanced.errors', {
        engine: searchRequest.engine || 'unknown',
        reason: (error as Error).message
      });

      throw error;
    }
  }

  private buildMeilisearchFilter(filters: any): string {
    const filterParts: string[] = [];

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          const valueString = value.map(v => `"${v}"`).join(' OR ');
          filterParts.push(`${key} IN [${valueString}]`);
        } else {
          filterParts.push(`${key} = "${value}"`);
        }
      }
    });

    return filterParts.join(' AND ');
  }

  private async extractFacets(results: SearchDocument[], facets: string[]): Promise<any> {
    const facetResults: any = {};

    facets.forEach(facet => {
      const facetValues: { [key: string]: number } = {};

      results.forEach(doc => {
        const value = (doc as any)[facet];
        if (value) {
          if (Array.isArray(value)) {
            value.forEach(v => {
              facetValues[v] = (facetValues[v] || 0) + 1;
            });
          } else {
            facetValues[value] = (facetValues[value] || 0) + 1;
          }
        }
      });

      facetResults[facet] = Object.entries(facetValues)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10); // Top 10 facet values
    });

    return facetResults;
  }

  async getCostReport(): Promise<any> {
    return this.aiOrchestrator.getCostReport();
  }

  /**
   * Get query analytics for a user (Phase 1 feature)
   */
  async getQueryAnalytics(userId: string): Promise<any> {
    if (!this.queryCapture) {
      this.initializeQueryLearningComponents();
    }

    if (!this.queryCapture) {
      return {
        recentQueries: [],
        topPatterns: [],
        suggestions: [],
        totalQueries: 0,
        averageResponseTime: 0,
        error: 'Query learning not available'
      };
    }

    try {
      return await this.queryCapture.getQueryAnalytics(userId);
    } catch (error) {
      this.logger.error('Failed to get query analytics', {
        userId,
        error: (error as Error).message
      });

      return {
        recentQueries: [],
        topPatterns: [],
        suggestions: [],
        totalQueries: 0,
        averageResponseTime: 0,
        error: 'Failed to retrieve analytics'
      };
    }
  }
}