// Main Cloudflare Worker entry point

import { ContentSkimmer } from './core/ContentSkimmer';
import { AuthValidator } from './security/AuthValidator';
import type { ExecutionContext } from '@cloudflare/workers-types';
import { FileRegistrationEvent, SkimmerConfig } from './types';

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    try {
      // Load configuration from environment
      const config: SkimmerConfig = {
        openaiApiKey: env.OPENAI_API_KEY,
        anthropicApiKey: env.ANTHROPIC_API_KEY,
        meilisearchUrl: env.MEILISEARCH_URL,
        meilisearchApiKey: env.MEILISEARCH_API_KEY,
        dataServiceUrl: env.DATA_SERVICE_URL,
        contentStoreServiceUrl: env.CONTENT_STORE_SERVICE_URL,
        dataServiceApiKey: env.DATA_SERVICE_API_KEY,
        webhookSecret: env.WEBHOOK_SECRET,
        jwtSecret: env.AUTH_JWT_SECRET,
        logLevel: env.LOG_LEVEL || 'info'
      };

      // Initialize services
      const skimmer = new ContentSkimmer(config, env);
      const authValidator = new AuthValidator(config);

      const url = new URL(request.url);
      
      // Root route handler for independent API testing
      if (url.pathname === '/' && request.method === 'GET') {
        return new Response(
          'Content Skimmer Worker is running.\n\nTry /health for status or POST to /webhook/file-registered.',
          { status: 200, headers: { 'Content-Type': 'text/plain' } }
        );
      }

      // Health check endpoint
      if (url.pathname === '/health') {
        const { healthChecker, metricsCollector } = await import('./monitoring/Metrics');
        const { circuitBreakerManager } = await import('./utils/CircuitBreaker');
        
        const healthStatus = await healthChecker.runChecks();
        const queueStatus = await skimmer.getQueueStatus();
        const processingMetrics = metricsCollector.getProcessingMetrics();
        const circuitBreakerStatus = circuitBreakerManager.getAllStatus();
        const costReport = await skimmer.getCostReport();
        
        return new Response(JSON.stringify({ 
          status: healthStatus.status,
          timestamp: new Date().toISOString(),
          health: healthStatus,
          queue: queueStatus,
          metrics: processingMetrics,
          circuitBreakers: circuitBreakerStatus,
          costs: costReport
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // File processing webhook endpoint
      if (url.pathname === '/webhook/file-registered' && request.method === 'POST') {
        // Validate webhook signature
        if (!await authValidator.validateWebhook(request.clone() as any)) {
          return new Response('Unauthorized', { status: 401 });
        }

        const event: FileRegistrationEvent = await request.json();
        
        // Process file asynchronously using waitUntil to prevent timeout
        ctx.waitUntil(skimmer.processFile(event));

        return new Response(JSON.stringify({ 
          message: 'File processing initiated',
          fileId: event.fileId 
        }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Manual processing trigger endpoint
      if (url.pathname === '/process' && request.method === 'POST') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return new Response('Unauthorized', { status: 401 });
        }

        try {
          const token = authHeader.substring(7);
          await authValidator.validateJWT(token);
        } catch (error) {
          return new Response('Invalid token', { status: 401 });
        }

        const event: FileRegistrationEvent = await request.json();
        
        ctx.waitUntil(skimmer.processFile(event));

        return new Response(JSON.stringify({ 
          message: 'File processing initiated',
          fileId: event.fileId 
        }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Search endpoint for downstream services
      if (url.pathname === '/search' && request.method === 'GET') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return new Response('Unauthorized', { status: 401 });
        }

        try {
          const token = authHeader.substring(7);
          const payload = await authValidator.validateJWT(token);
          const userId = payload.userId;

          const query = url.searchParams.get('q');
          const engine = url.searchParams.get('engine') || 'all'; // 'meilisearch', 'vectorize', or 'all'
          const limit = parseInt(url.searchParams.get('limit') || '20');

          if (!query) {
            return new Response(JSON.stringify({ error: 'Query parameter "q" is required' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          const results = await skimmer.searchContent(query, userId, engine, limit);

          return new Response(JSON.stringify({
            query,
            engine,
            results,
            total: results.length
          }), {
            headers: { 'Content-Type': 'application/json' }
          });

        } catch (error) {
          return new Response('Invalid token', { status: 401 });
        }
      }

      // Advanced search endpoint with filters
      if (url.pathname === '/search/advanced' && request.method === 'POST') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return new Response('Unauthorized', { status: 401 });
        }

        try {
          const token = authHeader.substring(7);
          const payload = await authValidator.validateJWT(token);
          const userId = payload.userId;

          const searchRequest = await request.json();
          const results = await skimmer.advancedSearch(searchRequest, userId);

          return new Response(JSON.stringify(results), {
            headers: { 'Content-Type': 'application/json' }
          });

        } catch (error) {
          return new Response('Invalid token', { status: 401 });
        }
      }

      // Query analytics endpoint (Phase 1 feature)
      if (url.pathname === '/search/analytics' && request.method === 'GET') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return new Response('Unauthorized', { status: 401 });
        }

        try {
          const token = authHeader.substring(7);
          const payload = await authValidator.validateJWT(token);
          const userId = payload.userId;

          const analytics = await skimmer.getQueryAnalytics(userId);

          return new Response(JSON.stringify(analytics), {
            headers: { 'Content-Type': 'application/json' }
          });

        } catch (error) {
          return new Response('Invalid token', { status: 401 });
        }
      }

      // Initialize query learning schema endpoint (admin only)
      if (url.pathname === '/admin/init-query-learning' && request.method === 'POST') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return new Response('Unauthorized', { status: 401 });
        }

        try {
          const token = authHeader.substring(7);
          const payload = await authValidator.validateJWT(token);
          
          // Check if user has admin role (you'll need to implement this)
          if (!payload.roles?.includes('admin')) {
            return new Response('Forbidden', { status: 403 });
          }

          const success = await skimmer.initializeQueryLearning();

          return new Response(JSON.stringify({ 
            success,
            message: success ? 'Query learning schema initialized' : 'Failed to initialize schema'
          }), {
            headers: { 'Content-Type': 'application/json' }
          });

        } catch (error) {
          return new Response('Invalid token', { status: 401 });
        }
      }

      return new Response('Not Found', { status: 404 });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ 
        error: 'Internal Server Error',
        message: (error as Error).message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
