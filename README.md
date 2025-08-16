# Content Skimmer

A Cloudflare Worker project for automated file analysis and enrichment. Integrates with Cloudflare R2 (file storage) and D1 (metadata/AI results). Designed for event-driven, serverless, and pay-as-you-grow operation.

## Features
- Event-driven skimming of new files
- Modular AI provider integration (OpenAI, etc.)
- Stores summaries, entities, and enrichment in D1
- Stateless, scalable, and cost-efficient

## Project Structure
- `src/index.ts` - Worker entry point
- `src/ai/` - AI provider integrations
- `src/utils/` - R2, D1, and file helpers
- `.github/copilot-instructions.md` - Copilot guidance

## Deployment
- Uses Wrangler for Cloudflare deployment
- Requires R2 and D1 bindings

## Usage
1. Deploy with Wrangler
2. Trigger on new file registration
3. Skim, enrich, and store results

---
This project is a starting point. Extend with more AI providers, enrichment steps, and search/indexing as needed.
