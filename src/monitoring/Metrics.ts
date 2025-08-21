// Enhanced metrics collection and monitoring

export interface Metric {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
}

export interface ProcessingMetrics {
  totalFiles: number;
  successfulProcessing: number;
  failedProcessing: number;
  averageProcessingTime: number;
  searchIndexUpdates: number;
  circuitBreakerEvents: number;
}

export class MetricsCollector {
  private metrics: Metric[] = [];
  private startTimes = new Map<string, number>();

  // Counter metrics
  incrementCounter(name: string, tags?: Record<string, string>): void {
    this.addMetric(name, 1, 'counter', tags);
  }

  // Gauge metrics
  setGauge(name: string, value: number, tags?: Record<string, string>): void {
    this.addMetric(name, value, 'gauge', tags);
  }

  // Timer metrics
  startTimer(operationId: string): void {
    this.startTimes.set(operationId, Date.now());
  }

  endTimer(operationId: string, metricName: string, tags?: Record<string, string>): number {
    const startTime = this.startTimes.get(operationId);
    if (!startTime) {
      console.warn(`Timer not found for operation: ${operationId}`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.addMetric(metricName, duration, 'timer', tags);
    this.startTimes.delete(operationId);
    return duration;
  }

  // Histogram metrics
  recordHistogram(name: string, value: number, tags?: Record<string, string>): void {
    this.addMetric(name, value, 'histogram', tags);
  }

  private addMetric(name: string, value: number, type: Metric['type'], tags?: Record<string, string>): void {
    const metric: Metric = {
      name,
      value,
      timestamp: Date.now(),
      type,
      tags
    };

    this.metrics.push(metric);

    // Keep only last 1000 metrics to prevent memory bloat
    if (this.metrics.length > 1000) {
      this.metrics.shift();
    }
  }

  getMetrics(): Metric[] {
    return [...this.metrics];
  }

  getMetricsSince(timestamp: number): Metric[] {
    return this.metrics.filter(m => m.timestamp >= timestamp);
  }

  getProcessingMetrics(): ProcessingMetrics {
    const recentMetrics = this.getMetricsSince(Date.now() - 300000); // Last 5 minutes

    const totalFiles = recentMetrics.filter(m => m.name === 'file.processing.started').length;
    const successfulProcessing = recentMetrics.filter(m => m.name === 'file.processing.completed').length;
    const failedProcessing = recentMetrics.filter(m => m.name === 'file.processing.failed').length;
    const searchIndexUpdates = recentMetrics.filter(m => m.name === 'search.index.updated').length;
    const circuitBreakerEvents = recentMetrics.filter(m => m.name === 'circuit_breaker.opened').length;

    const processingTimes = recentMetrics
      .filter(m => m.name === 'file.processing.duration')
      .map(m => m.value);
    
    const averageProcessingTime = processingTimes.length > 0 
      ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length 
      : 0;

    return {
      totalFiles,
      successfulProcessing,
      failedProcessing,
      averageProcessingTime,
      searchIndexUpdates,
      circuitBreakerEvents
    };
  }

  clear(): void {
    this.metrics.length = 0;
    this.startTimes.clear();
  }
}

// Health check service
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, {
    status: 'pass' | 'fail' | 'warn';
    message?: string;
    duration?: number;
  }>;
  timestamp: string;
}

export class HealthChecker {
  private checks = new Map<string, () => Promise<{ status: 'pass' | 'fail' | 'warn'; message?: string }>>();

  addCheck(name: string, check: () => Promise<{ status: 'pass' | 'fail' | 'warn'; message?: string }>): void {
    this.checks.set(name, check);
  }

  async runChecks(): Promise<HealthStatus> {
    const results: HealthStatus['checks'] = {};
    let overallStatus: HealthStatus['status'] = 'healthy';

    for (const [name, check] of this.checks) {
      const startTime = Date.now();
      try {
        const result = await Promise.race([
          check(),
          new Promise<{ status: 'fail'; message: string }>((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), 5000)
          )
        ]);
        
        results[name] = {
          ...result,
          duration: Date.now() - startTime
        };

        if (result.status === 'fail') {
          overallStatus = 'unhealthy';
        } else if (result.status === 'warn' && overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }
      } catch (error) {
        results[name] = {
          status: 'fail',
          message: (error as Error).message,
          duration: Date.now() - startTime
        };
        overallStatus = 'unhealthy';
      }
    }

    return {
      status: overallStatus,
      checks: results,
      timestamp: new Date().toISOString()
    };
  }
}

// Global instances
export const metricsCollector = new MetricsCollector();
export const healthChecker = new HealthChecker();

// Initialize default health checks
healthChecker.addCheck('memory', async () => {
  // Basic memory check for Workers
  try {
    const used = (performance as any).memory?.usedJSHeapSize || 0;
    const limit = (performance as any).memory?.jsHeapSizeLimit || 100 * 1024 * 1024;
    const usage = used / limit;
    
    if (usage > 0.9) {
      return { status: 'fail', message: `Memory usage critical: ${Math.round(usage * 100)}%` };
    } else if (usage > 0.7) {
      return { status: 'warn', message: `Memory usage high: ${Math.round(usage * 100)}%` };
    } else {
      return { status: 'pass', message: `Memory usage normal: ${Math.round(usage * 100)}%` };
    }
  } catch {
    return { status: 'warn', message: 'Memory metrics not available' };
  }
});

healthChecker.addCheck('circuit_breakers', async () => {
  const { circuitBreakerManager } = await import('../utils/CircuitBreaker');
  const statuses = circuitBreakerManager.getAllStatus();
  const openBreakers = statuses.filter(s => s.state.state === 'OPEN');
  
  if (openBreakers.length > 0) {
    return { 
      status: 'warn', 
      message: `${openBreakers.length} circuit breakers open: ${openBreakers.map(b => b.serviceName).join(', ')}` 
    };
  }
  
  return { status: 'pass', message: 'All circuit breakers closed' };
});
