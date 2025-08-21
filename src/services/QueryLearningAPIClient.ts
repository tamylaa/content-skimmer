/**
 * Query Learning API Client for Content Skimmer
 * 
 * Replaces direct D1 access with API calls to data-service
 */

import { Logger } from '../monitoring/Logger';

export interface QueryEvent {
  id: string;
  userId: string;
  sessionId: string;
  queryText: string;
  searchEngine: string;
  timestamp: Date;
  resultCount: number;
  responseTime: number;
  resultsClicked?: string[];
  followUpQueries?: string[];
  taskCompleted?: boolean;
}

export interface QuerySession {
  id: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  status?: string;
  taskContext?: string;
}

export interface QueryPattern {
  id: string;
  userId: string;
  patternText: string;
  frequency: number;
  successRate: number;
  avgResponseTime: number;
  lastUpdated: Date;
}

// API Response interfaces
interface ApiResponse {
  success: boolean;
  error?: string;
  result?: any;
  results?: any[];
}

/**
 * Service for capturing and analyzing search queries via data-service API
 */
export class QueryCaptureService {
  private dataServiceUrl: string;
  private apiKey: string;
  private logger: Logger;

  constructor(dataServiceUrl: string, apiKey: string, logger: Logger) {
    this.dataServiceUrl = dataServiceUrl;
    this.apiKey = apiKey;
    this.logger = logger;
  }

  /**
   * Capture a search query event via API
   */
  async captureQuery(event: Omit<QueryEvent, 'id' | 'timestamp'>): Promise<string> {
    try {
      const queryEvent: QueryEvent = {
        ...event,
        id: this.generateQueryId(),
        timestamp: new Date()
      };

      const response = await fetch(`${this.dataServiceUrl}/search/query-events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          id: queryEvent.id,
          user_id: queryEvent.userId,
          session_id: queryEvent.sessionId,
          query_text: queryEvent.queryText,
          search_engine: queryEvent.searchEngine,
          timestamp: queryEvent.timestamp!.toISOString(),
          result_count: queryEvent.resultCount,
          response_time: queryEvent.responseTime,
          results_clicked: JSON.stringify(queryEvent.resultsClicked || []),
          follow_up_queries: queryEvent.followUpQueries?.join(',') || null,
          task_completed: queryEvent.taskCompleted || false
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as ApiResponse;
      if (!result.success) {
        throw new Error(result.error || 'Unknown API error');
      }

      this.logger.info('Query captured via API', {
        queryId: queryEvent.id,
        userId: queryEvent.userId,
        queryText: queryEvent.queryText
      });

      return queryEvent.id;

    } catch (error) {
      this.logger.error('Failed to capture query via API', {
        error: (error as Error).message,
        userId: event.userId
      });
      // Return empty string on failure - don't break search
      return '';
    }
  }

  /**
   * Capture user interaction with search results via API
   */
  async captureQueryInteraction(queryId: string, interaction: {
    resultsClicked?: string[];
    followUpQuery?: string;
    taskCompleted?: boolean;
  }): Promise<void> {
    if (!queryId) return; // Skip if no valid query ID

    try {
      const response = await fetch(`${this.dataServiceUrl}/search/query-events/${queryId}/interactions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          resultsClicked: interaction.resultsClicked || [],
          followUpQuery: interaction.followUpQuery || null,
          taskCompleted: interaction.taskCompleted || false
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as ApiResponse;
      if (!result.success) {
        throw new Error(result.error || 'Unknown API error');
      }

    } catch (error) {
      this.logger.error('Failed to capture query interaction via API', {
        error: (error as Error).message,
        queryId
      });
    }
  }

  /**
   * Get recent queries for a user via API
   */
  async getRecentQueries(userId: string, days: number = 30): Promise<QueryEvent[]> {
    try {
      const response = await fetch(`${this.dataServiceUrl}/search/query-events/recent?userId=${userId}&days=${days}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as ApiResponse;
      if (!result.success) {
        throw new Error(result.error || 'Unknown API error');
      }

      return result.results?.map((row: any) => this.mapRowToQueryEvent(row)) || [];
    } catch (error) {
      this.logger.error('Failed to get recent queries via API', {
        error: (error as Error).message,
        userId
      });
      return [];
    }
  }

  /**
   * Analyze user query patterns via API
   */
  async getUserQueryPatterns(userId: string): Promise<QueryPattern[]> {
    try {
      const response = await fetch(`${this.dataServiceUrl}/search/query-patterns?userId=${userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as ApiResponse;
      if (!result.success) {
        throw new Error(result.error || 'Unknown API error');
      }

      return result.results || [];
    } catch (error) {
      this.logger.error('Failed to get user query patterns via API', {
        error: (error as Error).message,
        userId
      });
      return [];
    }
  }

  private generateQueryId(): string {
    return `query-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private mapRowToQueryEvent(row: any): QueryEvent {
    return {
      id: row.id,
      userId: row.user_id,
      sessionId: row.session_id,
      queryText: row.query_text,
      searchEngine: row.search_engine,
      timestamp: new Date(row.timestamp),
      resultCount: row.result_count,
      responseTime: row.response_time,
      resultsClicked: row.results_clicked ? JSON.parse(row.results_clicked) : undefined,
      followUpQueries: row.follow_up_queries ? row.follow_up_queries.split(',') : undefined,
      taskCompleted: row.task_completed
    };
  }
}

/**
 * Session manager for tracking user search sessions via API
 */
export class SessionManager {
  private dataServiceUrl: string;
  private apiKey: string;
  private activeSessions = new Map<string, string>(); // userId -> sessionId

  constructor(dataServiceUrl: string, apiKey: string) {
    this.dataServiceUrl = dataServiceUrl;
    this.apiKey = apiKey;
  }

  async getOrCreateSession(userId: string): Promise<string> {
    // Check for active session (within last 30 minutes)
    const activeSessionId = this.activeSessions.get(userId);
    if (activeSessionId && await this.isSessionActive(activeSessionId)) {
      return activeSessionId;
    }

    // Create new session via API
    const sessionId = this.generateSessionId();
    await this.createSession(sessionId, userId);
    this.activeSessions.set(userId, sessionId);
    
    return sessionId;
  }

  private async isSessionActive(sessionId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.dataServiceUrl}/search/query-sessions/active?userId=${sessionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) return false;

      const result = await response.json() as ApiResponse;
      if (!result.success || !result.results?.length) return false;

      const lastActivity = new Date(result.results[0].start_time);
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      
      return lastActivity > thirtyMinutesAgo;
    } catch (error) {
      return false;
    }
  }

  private async createSession(sessionId: string, userId: string): Promise<void> {
    try {
      const response = await fetch(`${this.dataServiceUrl}/search/query-sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          id: sessionId,
          user_id: userId,
          start_time: new Date().toISOString(),
          status: 'active'
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as ApiResponse;
      if (!result.success) {
        throw new Error(result.error || 'Unknown API error');
      }
    } catch (error) {
      // Log but don't throw - session creation failure shouldn't break search
      console.error('Failed to create session via API:', error);
    }
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
