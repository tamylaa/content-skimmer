// Main orchestrator for the content skimming process awareness

import { FileRegistrationEvent, AnalysisResult, SearchDocument, SkimmerConfig, ProcessingContext } from '../types';
import { DataService } from '../services/DataService';
import { ContentStoreService } from '../services/ContentStoreService';
import { AIOrchestrator } from '../ai/AIOrchestrator';
import { SearchFactory } from '../search/SearchFactory';
import { EventBus } from '../events/EventBus';
import { RetryQueue } from '../events/RetryQueue';
import { Logger } from '../monitoring/logger';

export class ContentSkimmer {
  private dataService: DataService;
  private contentStoreService: ContentStoreService;
  private aiOrchestrator: AIOrchestrator;
  private searchEngines: any[];
  private eventBus: EventBus;
  private retryQueue: RetryQueue;
  private logger: Logger;

  constructor(config: SkimmerConfig, env: any) {
    this.dataService = new DataService(config.dataServiceUrl, config.dataServiceApiKey);
    this.contentStoreService = new ContentStoreService(config.contentStoreServiceUrl, config.dataServiceApiKey);
    this.aiOrchestrator = new AIOrchestrator(config);
    this.searchEngines = SearchFactory.createAllSearchEngines(config, env);
    this.eventBus = new EventBus();
    this.retryQueue = new RetryQueue();
    this.logger = new Logger(config.logLevel);

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

  async processFile(event: FileRegistrationEvent): Promise<void> {
    const context: ProcessingContext = {
      fileId: event.fileId,
      userId: event.userId,
      startTime: Date.now(),
      retryCount: 0
    };

    this.logger.info('Starting file processing', { 
      fileId: event.fileId, 
      filename: event.filename,
      mimeType: event.mimeType,
      fileSize: event.fileSize
    });

    try {
      // Update status to processing
      await this.dataService.updateFileStatus(event.fileId, 'analyzing');

      // Check if AI can handle this file type
      if (!this.aiOrchestrator.hasCompatibleProvider(event.mimeType)) {
        throw new Error(`Unsupported file type: ${event.mimeType}`);
      }

      // Get file content
      const fileBuffer = await this.getFileContent(event);

      // Perform AI analysis
      const aiResult = await this.aiOrchestrator.analyzeFile(fileBuffer, event.mimeType);

      // Prepare analysis result
      const analysisResult: AnalysisResult = {
        fileId: event.fileId,
        summary: aiResult.summary,
        entities: aiResult.entities,
        topics: aiResult.topics,
        enrichment: aiResult.enrichment,
        r2References: [], // TODO: Handle large outputs stored in R2
        analysisStatus: 'completed'
      };

      // Save results to data service
      await this.dataService.saveAnalysisResults(analysisResult);
      await this.dataService.updateFileStatus(event.fileId, 'analyzed');

      // Emit completion event for search indexing
      await this.eventBus.emit('analysis_completed', { result: analysisResult, context, event });

      const processingTime = Date.now() - context.startTime;
      this.logger.info('File processing completed', {
        fileId: event.fileId,
        processingTimeMs: processingTime,
        entitiesFound: aiResult.entities.length,
        topicsFound: aiResult.topics.length
      });

    } catch (error) {
      await this.eventBus.emit('analysis_failed', { error, context, event });
      throw error;
    }
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
          () => searchEngine.indexDocument(searchDoc)
        );
      }

      this.logger.info('Search index update queued', {
        fileId: result.fileId,
        searchEngines: this.searchEngines.length
      });

    } catch (error) {
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

    try {
      await this.dataService.updateFileStatus(context.fileId, 'analysis_failed', error.message);
    } catch (updateError) {
      this.logger.error('Failed to update error status', {
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
}