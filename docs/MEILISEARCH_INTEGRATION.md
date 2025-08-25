# Meilisearch Integration for Content Skimmer

## Project Goal
Design and deploy a Meilisearch solution that complements the Content Skimmer Cloudflare Worker, providing fast, scalable, and secure search capabilities. The solution should integrate seamlessly with D1 for metadata and results storage, and follow the stateless, event-driven, and modular architecture of the main project.

## Requirements

### 1. Deployment
- Managed Meilisearch Cloud or secure self-hosted (Docker, VM, or cloud provider)
- HTTPS endpoint accessible from Cloudflare Worker
- Scalable for small-to-medium workloads
- Network restricted to trusted services (preferably not public)

### 2. Security
- API key authentication for write/admin operations
- Read-only key for search queries
- Optionally, rely on JWT-based service-to-service auth if Meilisearch is private
- Secure key storage and rotation procedures

### 3. Data Model & Indexing
- Indexes should mirror D1 data structure for fast lookup
- Store document metadata (id, title, summary, entities, topics, userId, filename, mimeType, uploadedAt, lastAnalyzed, etc.)
- Support for full-text search, filters (entities, topics, date ranges), and sorting
- Efficient upsert/delete operations to keep Meilisearch in sync with D1

### 4. Integration
- Node.js/TypeScript integration using official Meilisearch JS client
- Functions to add, update, delete, and search documents
- Example code for syncing D1 changes to Meilisearch
- Sample .env for API keys and endpoint

### 5. Data Flow
- D1 is the source of truth for metadata/results
- On content update, trigger Meilisearch index update
- On search, query Meilisearch for fast results, then hydrate with D1 if needed

### 6. Monitoring & Maintenance
- Health checks, usage, and performance monitoring
- Backup/restore and scaling guidance

### 7. Documentation
- Clear setup, integration, and operational docs
- Best practices for production
- Links to official Meilisearch and D1 docs

---

## Prompt for AI/DevOps/Consultant

I need a Meilisearch deployment and integration plan that matches the following:
- Integrates with a Cloudflare Worker (Content Skimmer) and D1 for metadata/results
- Stateless, event-driven, modular, and secure
- Supports full-text and filtered search on document metadata
- Syncs with D1 on content changes
- Uses API keys or JWT for access control
- Provides Node.js/TypeScript integration examples
- Includes monitoring, backup, and scaling guidance

Please provide step-by-step instructions, code samples, and best practices for this architecture.
