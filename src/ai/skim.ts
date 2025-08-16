import { skimContent } from './index';
import { extractEntities, extractTopics } from './enrichments';

export async function skimFile(fileBuffer: ArrayBuffer, fileType: string, env: any): Promise<any> {
  const aiResult = await skimContent(fileBuffer, fileType, env);
  let entities: string[] = [];
  let topics: string[] = [];
  if (fileType === 'text') {
    const text = new TextDecoder().decode(fileBuffer);
    entities = await extractEntities(text);
    topics = await extractTopics(text);
  }
  return {
    ...aiResult,
    entities,
    topics,
    enrichment: {} // Placeholder for future enrichments
  };
}
