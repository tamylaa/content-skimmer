// Retry mechanism for failed operations

export interface RetryableOperation {
  id: string;
  operation: () => Promise<void>;
  maxRetries: number;
  currentRetry: number;
  lastError?: Error;
  nextRetryAt: number;
}

export class RetryQueue {
  private operations: Map<string, RetryableOperation> = new Map();
  private isProcessing = false;

  addOperation(
    id: string,
    operation: () => Promise<void>,
    maxRetries: number = 3
  ): void {
    this.operations.set(id, {
      id,
      operation,
      maxRetries,
      currentRetry: 0,
      nextRetryAt: Date.now()
    });

    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const now = Date.now();
      const readyOperations = Array.from(this.operations.values())
        .filter(op => op.nextRetryAt <= now);

      for (const op of readyOperations) {
        try {
          await op.operation();
          this.operations.delete(op.id);
        } catch (error) {
          op.lastError = error as Error;
          op.currentRetry++;

          if (op.currentRetry >= op.maxRetries) {
            console.error(`Operation ${op.id} failed after ${op.maxRetries} retries:`, error);
            this.operations.delete(op.id);
          } else {
            // Exponential backoff: 2^retry * 1000ms
            op.nextRetryAt = now + Math.pow(2, op.currentRetry) * 1000;
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }

    // Schedule next processing if there are pending operations
    if (this.operations.size > 0) {
      setTimeout(() => this.processQueue(), 5000);
    }
  }

  getQueueStatus(): { pending: number; operations: RetryableOperation[] } {
    return {
      pending: this.operations.size,
      operations: Array.from(this.operations.values())
    };
  }
}