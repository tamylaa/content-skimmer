# Search Strategy for Content Skimmer & Downstream Services

## Overview

As file and summary volume grows, robust, scalable, and fast search is critical for content discovery, selection, and downstream use. This document outlines the recommended architecture, technology choices, and integration patterns to ensure the content-skimmer and related services enable a seamless search experience—now and as the system scales.

---

## Key Principles

- **D1 is for metadata, not for large-scale or full-text search.**
- **Dedicated search/indexing engine** (e.g., Meilisearch, Typesense, or Cloudflare Vectorize) is required for scalable, fast, and feature-rich search.
- **Hybrid storage:** Store small, structured AI results (summaries, entities) in D1; store large/unstructured outputs in R2, with references in D1.
- **Event-driven sync:** Keep D1 and the search engine in sync via events or atomic updates.
- **Cloudflare-native and zero-ops** solutions are preferred for cost and operational efficiency.

---

## Recommended Architecture

1. **File Upload & Registration**
   - File stored in R2 via content-store-service.
   - Metadata registered in D1 via data-service.

2. **AI Skimming & Enrichment**
   - content-skimmer performs AI analysis.
   - Summaries/entities stored in D1 (if small); large outputs in R2 with D1 pointer.

3. **Search Indexing**
   - On every update, push searchable fields (title, summary, entities, tags, etc.) to the search engine.
   - Use Meilisearch (on Fly.io/Railway) for classic search, or Cloudflare Vectorize for semantic search.
   - Optionally, use both for maximum flexibility.

4. **Downstream Search & Selection**
   - All search/filter/discovery queries go to the search engine, not D1.
   - D1 remains the source of truth for metadata and pointers.

---

## Technology Options

| Engine         | Cloudflare Native | Full-text | Semantic | Zero-ops | Cost      | Best For                  |
|----------------|------------------|-----------|----------|----------|-----------|---------------------------|
| Meilisearch    | No               | ✅        | 🚫       | 🚫 (low) | Free/low  | Keyword/faceted search    |
| Typesense      | No (beta soon)   | ✅        | 🚫       | 🚫 (low) | Free/low  | Keyword/faceted search    |
| Vectorize      | ✅               | 🚫        | ✅       | ✅       | Free/usage| Semantic/AI search        |
| Workers KV     | ✅               | 🚫        | 🚫       | ✅       | Free/low  | Simple key/tag search     |

---

## Best Practices

- **Index all searchable fields** (summary, entities, tags, user, etc.) in the search engine.
- **Keep D1 and the search index in sync**—on create, update, and delete.
- **Cache hot queries/results** for ultra-fast repeated access.
- **Design for both keyword and semantic search** if possible.
- **Secure search endpoints** with authentication and access control.

---

## Implementation Notes

- **content-skimmer** should trigger search index updates after skimming/enrichment.
- **data-service** should expose endpoints for search and for pushing updates to the search engine.
- **content-store-service** should notify the search engine on file deletion or metadata changes.
- **Downstream services** (campaigns, dashboards, etc.) should use the search engine for discovery, not D1 directly.

---

## Future-Proofing

- Start with Meilisearch or Vectorize as appropriate; architect so you can add or swap engines as needs evolve.
- Monitor search performance and scale up (or switch to managed/cloud-native) as data grows.
- Consider hybrid search (keyword + semantic) for best user experience.

---

## Summary

A dedicated, scalable search engine—kept in sync with D1 and R2—is essential for professional, high-volume content discovery. This strategy ensures the content-skimmer and all downstream services can deliver fast, reliable, and feature-rich search and selection, now and