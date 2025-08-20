// Main orchestrator for the content skimming process awareness

import { FileRegistrationEvent, AnalysisResult, SearchDocument, SkimmerConfig, ProcessingContext } from '../types';
import { DataService } from '../services/DataService';
import { ContentStoreService } from '../services/ContentStoreService';
import { AIOrchestrator } from '../ai/AIOrchestrator';
import { SearchFactory } from '../search/SearchFactory';
import { EventBus } from '../events/EventBus';
import { RetryQueue } from '../events/RetryQueue';
import { Logger } from '../monitoring/Logger';

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

    const jobId = `job-${Date.now()}-${event.fileId}`;

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
        throw new Error(error);
      }

      // Get file content
      const fileBuffer = await this.getFileContent(event);

      // Perform AI analysis
      const aiResult = await this.aiOrchestrator.analyzeFile(fileBuffer, event.mimeType);

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

      const processingTime = Date.now() - context.startTime;
      this.logger.info('File processing completed successfully', {
        fileId: event.fileId,
        jobId,
        processingTimeMs: processingTime,
        entitiesFound: aiResult.entities?.length || 0,
        topicsFound: aiResult.topics?.length || 0
      });

    } catch (error) {
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
}