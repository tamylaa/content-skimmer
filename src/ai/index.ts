// Modular AI provider entry (stub)
import { summarizeText } from './openai.js';

export async function skimContent(fileBuffer: ArrayBuffer, fileType: string, env: any): Promise<any> {
  // Example: Only handle text for now
  if (fileType === 'text') {
    const text = new TextDecoder().decode(fileBuffer);
    const summary = await summarizeText(text, env.OPENAI_API_KEY);
    return { summary };
  }
  // TODO: Add PDF, image, video, etc.
  return { summary: 'Unsupported file type.' };
}
