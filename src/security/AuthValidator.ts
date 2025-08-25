// Authentication and authorization validation

import { SkimmerConfig } from '../types/index.js';

export class AuthValidator {
  private webhookSecret: string;
  private jwtSecret: string;

  constructor(config: SkimmerConfig) {
    this.webhookSecret = config.webhookSecret;
    this.jwtSecret = config.authJwtSecret;  // Use the correct property name
  }

  async validateWebhook(request: Request): Promise<boolean> {
    const signature = request.headers.get('x-signature-256');
    if (!signature) return false;

    const body = await request.text();
    const expectedSignature = await this.computeSignature(body);
    
    return signature === expectedSignature;
  }

  async validateJWT(token: string): Promise<any> {
    // Simplified JWT validation - in production use a proper JWT library
    try {
      const [header, payload, signature] = token.split('.');
      const decodedPayload = JSON.parse(atob(payload));
      
      // Verify expiration
      if (decodedPayload.exp && decodedPayload.exp < Date.now() / 1000) {
        throw new Error('Token expired');
      }
      
      return decodedPayload;
    } catch (error) {
      throw new Error('Invalid JWT token');
    }
  }

  private async computeSignature(body: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.webhookSecret);
    const bodyData = encoder.encode(body);
    
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, bodyData);
    return `sha256=${Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')}`;
  }
}