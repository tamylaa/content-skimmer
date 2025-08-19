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
        return new Response(JSON.stringify({ 
          status: 'healthy',
          timestamp: new Date().toISOString(),
          queue: await skimmer.getQueueStatus()
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
