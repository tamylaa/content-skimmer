# Content Skimmer: Assumptions & Expectations Document

## Service Dependencies & Interfaces

### 1. Content Store Service
**Expected Interface:**
```typescript
// Webhook/Event payload we expect to receive
interface FileRegistrationEvent {
  fileId: string;
  userId: string;
  filename: string;
  r2Key: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  signedUrl?: string; // For secure file access
}

// API we expect content-store-service to provide
POST /api/files/{fileId}/signed-url
Response: { signedUrl: string, expiresAt: string }
```

**Assumptions:**
- Content-store-service will emit events when files are uploaded/deleted
- Signed URLs will be provided for secure file access
- File metadata is accurate (size, type, etc.)

### 2. Data Service
**Expected Interface:**
```typescript
// Endpoints we need data-service to provide
GET /api/files/{fileId}/metadata
POST /api/files/{fileId}/analysis-results
PUT /api/files/{fileId}/status
DELETE /api/files/{fileId}/search-index

// Data structures we'll send/receive
interface AnalysisResult {
  fileId: string;
  summary: string;
  entities: string[];
  topics: string[];
  enrichment: object;
  r2References: string[]; // For large outputs stored in R2
  analysisStatus: 'pending' | 'completed' | 'failed';
  error?: string;
}
```

**Assumptions:**
- Data-service provides atomic operations for D1 updates
- Migration scripts will be provided for new fields
- API supports both read and write operations for search synchronization

### 3. Search Engine Service
**Expected Interface:**
```typescript
// For Meilisearch integration
POST /indexes/{indexName}/documents
DELETE /indexes/{indexName}/documents/{documentId}
GET /indexes/{indexName}/search?q={query}

// For Cloudflare Vectorize
POST /vectorize/upsert
DELETE /vectorize/delete
POST /vectorize/query

// Standardized document format we'll index
interface SearchDocument {
  id: string;
  title: string;
  summary: string;
  entities: string[];
  topics: string[];
  userId: string;
  filename: string;
  mimeType: string;
  uploadedAt: string;
  lastAnalyzed: string;
}
```

**Assumptions:**
- Search engine supports both keyword and semantic search
- Bulk operations are available for efficient indexing
- API keys and authentication are properly configured

## External Dependencies

### 1. AI Providers
**OpenAI API:**
```typescript
// Expected capabilities
- Text extraction from documents
- Summarization with configurable length
- Entity extraction (people, places, organizations)
- Topic classification
- Language detection
```

**Assumptions:**
- API keys are available and properly scoped
- Rate limits are understood and respected
- Fallback providers are available if primary fails

### 2. Cloudflare Infrastructure
**R2 Storage:**
- Files are accessible via signed URLs
- No direct R2 access required (security best practice)

**D1 Database:**
- Accessed only through data-service API
- Supports atomic operations and transactions

**Workers Environment:**
- Environment variables for API keys and configuration
- Proper bindings for Queues (if used)

## Configuration Requirements

### Environment Variables Needed:
```env
# AI Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=...

# Search Engines
MEILISEARCH_HOST=https://...
MEILIS_MASTER_KEY=...
VECTORIZE_BINDING=...

# Service Endpoints
DATA_SERVICE_URL=https://...
CONTENT_STORE_SERVICE_URL=https://...
DATA_SERVICE_API_KEY=...

# Security
WEBHOOK_SECRET=...
JWT_SECRET=...

# Monitoring
LOG_LEVEL=info
METRICS_ENDPOINT=...
```

## Performance Expectations

### Response Times:
- File analysis: < 30 seconds for typical documents
- Search indexing: < 5 seconds after analysis completion
- API responses: < 2 seconds for metadata operations

### Throughput:
- Support 100+ concurrent file analysis operations
- Handle 1000+ search index updates per minute
- Process files up to 100MB efficiently

### Reliability:
- 99.9% uptime for critical operations
- Automatic retry for transient failures
- Graceful degradation when external services are unavailable

## Security Requirements

### Authentication:
- All webhook/event sources must be verified
- API keys must be securely stored and rotated
- Access control based on user/organization context

### Data Protection:
- No sensitive file content stored in logs
- All external API calls use HTTPS
- Temporary files cleaned up after processing

## Success Criteria

### Functional:
- ✅ Files are analyzed within SLA timeframes
- ✅ Search results are comprehensive and fast
- ✅ No data loss during processing or indexing
- ✅ Proper error handling and user feedback

### Non-Functional:
- ✅ Zero-downtime deployments
- ✅ Horizontal scaling under load
- ✅ Cost-efficient operation (pay-as-you-grow)
- ✅ Comprehensive monitoring and alerting

## Integration Points

### Incoming:
1. **File Registration Events** from content-store-service
2. **Manual Analysis Triggers** from dashboard/UI
3. **Reprocessing Requests** for algorithm updates

### Outgoing:
1. **Analysis Results** to data-service
2. **Search Index Updates** to search engine
3. **Status Updates** to originating services
4. **Metrics and Logs** to monitoring systems

---

This document serves as the contract between content-skimmer and all dependent services. Any changes to these interfaces or assumptions must be coordinated across all teams.