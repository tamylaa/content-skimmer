// Circuit breaker pattern for external service calls

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringWindow: number;
}

export interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  nextAttemptTime: number;
}

export class CircuitBreaker {
  private state: CircuitBreakerState;
  private config: CircuitBreakerConfig;
  private serviceName: string;

  constructor(serviceName: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.serviceName = serviceName;
    this.config = {
      failureThreshold: config.failureThreshold || 5,
      recoveryTimeout: config.recoveryTimeout || 60000, // 1 minute
      monitoringWindow: config.monitoringWindow || 300000, // 5 minutes
      ...config
    };
    
    this.state = {
      failures: 0,
      lastFailureTime: 0,
      state: 'CLOSED',
      nextAttemptTime: 0
    };
  }

  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    if (this.shouldReject()) {
      if (fallback) {
        console.warn(`Circuit breaker OPEN for ${this.serviceName}, using fallback`);
        return fallback();
      }
      throw new Error(`Circuit breaker OPEN for ${this.serviceName}`);
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      
      if (fallback && this.state.state === 'OPEN') {
        console.warn(`Service ${this.serviceName} failed, using fallback`);
        return fallback();
      }
      
      throw error;
    }
  }

  private shouldReject(): boolean {
    const now = Date.now();
    
    switch (this.state.state) {
      case 'CLOSED':
        return false;
        
      case 'OPEN':
        if (now >= this.state.nextAttemptTime) {
          this.state.state = 'HALF_OPEN';
          return false;
        }
        return true;
        
      case 'HALF_OPEN':
        return false;
        
      default:
        return false;
    }
  }

  private onSuccess(): void {
    this.state.failures = 0;
    this.state.state = 'CLOSED';
    this.state.nextAttemptTime = 0;
  }

  private onFailure(): void {
    const now = Date.now();
    this.state.failures++;
    this.state.lastFailureTime = now;

    if (this.state.failures >= this.config.failureThreshold) {
      this.state.state = 'OPEN';
      this.state.nextAttemptTime = now + this.config.recoveryTimeout;
      console.warn(`Circuit breaker OPENED for ${this.serviceName} after ${this.state.failures} failures`);
    }
  }

  getStatus(): { serviceName: string; state: CircuitBreakerState; config: CircuitBreakerConfig } {
    return {
      serviceName: this.serviceName,
      state: { ...this.state },
      config: { ...this.config }
    };
  }

  reset(): void {
    this.state = {
      failures: 0,
      lastFailureTime: 0,
      state: 'CLOSED',
      nextAttemptTime: 0
    };
  }
}

// Circuit breaker manager for multiple services
export class CircuitBreakerManager {
  private breakers = new Map<string, CircuitBreaker>();

  getBreaker(serviceName: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(serviceName)) {
      this.breakers.set(serviceName, new CircuitBreaker(serviceName, config));
    }
    return this.breakers.get(serviceName)!;
  }

  getAllStatus(): Array<{ serviceName: string; state: CircuitBreakerState; config: CircuitBreakerConfig }> {
    return Array.from(this.breakers.values()).map(breaker => breaker.getStatus());
  }

  resetAll(): void {
    this.breakers.forEach(breaker => breaker.reset());
  }
}

// Global circuit breaker manager instance
export const circuitBreakerManager = new CircuitBreakerManager();
