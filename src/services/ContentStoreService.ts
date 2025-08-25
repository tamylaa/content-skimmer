// Service for interacting with the content-store-service API

export class ContentStoreService {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async getSignedUrl(fileId: string): Promise<{ signedUrl: string; expiresAt: string }> {
    const response = await fetch(`${this.baseUrl}/files/${fileId}/signed-url`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get signed URL: ${response.statusText}`);
    }

    return response.json();
  }

  async downloadFile(signedUrl: string): Promise<ArrayBuffer> {
    const response = await fetch(signedUrl);

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    return response.arrayBuffer();
  }
}