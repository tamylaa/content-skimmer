/**
 * Phase 1 Implementation: Query Learning Service
 * 
 * Adds query capture and learning capabilities to the content skimmer.
 */

import { SearchDocument } from '../types';
import { D1QueryService } from './D1QueryService';
import { Logger } from '../monitoring/Logger';

// Core interfaces for query learning
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

export interface QueryPattern {
  pattern: string;
  frequency: number;
  averageResponseTime: number;
  successRate: number;
  commonFollowUps: string[];
}

export interface QuerySession {
  sessionId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  queries: QueryEvent[];
  taskContext?: string;
  completionStatus: 'success' | 'abandoned' | 'ongoing';
}

interface DatabaseRow {
  [key: string]: any;
}

/**
 * Service for capturing and analyzing search queries
 */
export class QueryCaptureService {
  private dbService: D1QueryService;
  private logger: Logger;

  constructor(dbService: D1QueryService, logger: Logger) {
    this.dbService = dbService;
    this.logger = logger;
  }

  /**
   * Capture a search query event
   */
  async captureQuery(event: Omit<QueryEvent, 'id' | 'timestamp'>): Promise<string> {
    try {
      const queryEvent: QueryEvent = {
        ...event,
        id: this.generateQueryId(),
        timestamp: new Date()
      };

      // Store in D1 database
      await this.dbService.execute(`
        INSERT INTO query_events (
          id, user_id, session_id, query_text, search_engine,
          timestamp, result_count, response_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        queryEvent.id,
        queryEvent.userId,
        queryEvent.sessionId,
        queryEvent.queryText,
        queryEvent.searchEngine,
        queryEvent.timestamp.toISOString(),
        queryEvent.resultCount,
        queryEvent.responseTime
      ]);

      this.logger.info('Query captured', {
        queryId: queryEvent.id,
        userId: queryEvent.userId,
        queryText: queryEvent.queryText
      });

      return queryEvent.id;

    } catch (error) {
      this.logger.error('Failed to capture query', {
        error: (error as Error).message,
        userId: event.userId
      });
      // Return empty string on failure - don't break search
      return '';
    }
  }

  /**
   * Capture user interaction with search results
   */
  async captureQueryInteraction(queryId: string, interaction: {
    resultsClicked?: string[];
    followUpQuery?: string;
    taskCompleted?: boolean;
  }): Promise<void> {
    if (!queryId) return; // Skip if no valid query ID

    try {
      await this.dbService.execute(`
        UPDATE query_events 
        SET results_clicked = ?, follow_up_queries = ?, task_completed = ?
        WHERE id = ?
      `, [
        JSON.stringify(interaction.resultsClicked || []),
        interaction.followUpQuery || null,
        interaction.taskCompleted || false,
        queryId
      ]);

    } catch (error) {
      this.logger.error('Failed to capture query interaction', {
        error: (error as Error).message,
        queryId
      });
    }
  }

  /**
   * Get recent queries for a user
   */
  async getRecentQueries(userId: string, days: number = 30): Promise<QueryEvent[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    try {
      const result = await this.dbService.query(`
        SELECT * FROM query_events 
        WHERE user_id = ? AND timestamp >= ?
        ORDER BY timestamp DESC
        LIMIT 50
      `, [userId, cutoffDate.toISOString()]);

      return result.results.map((row: DatabaseRow) => this.mapRowToQueryEvent(row));
    } catch (error) {
      this.logger.error('Failed to get recent queries', {
        error: (error as Error).message,
        userId
      });
      return [];
    }
  }

  /**
   * Analyze user query patterns
   */
  async getUserQueryPatterns(userId: string): Promise<QueryPattern[]> {
    try {
      const result = await this.dbService.query(`
        SELECT 
          query_text,
          COUNT(*) as frequency,
          AVG(response_time) as avg_response_time,
          AVG(CASE WHEN task_completed = 1 THEN 1.0 ELSE 0.0 END) as success_rate
        FROM query_events 
        WHERE user_id = ? AND timestamp >= datetime('now', '-30 days')
        GROUP BY query_text
        HAVING frequency >= 2
        ORDER BY frequency DESC
        LIMIT 20
      `, [userId]);

      return result.results.map((row: DatabaseRow) => ({
        pattern: row.query_text,
        frequency: row.frequency,
        averageResponseTime: row.avg_response_time,
        successRate: row.success_rate,
        commonFollowUps: [] // Will be populated in Phase 2
      }));
    } catch (error) {
      this.logger.error('Failed to get user query patterns', {
        error: (error as Error).message,
        userId
      });
      return [];
    }
  }

  /**
   * Get query analytics summary for a user
   */
  async getQueryAnalytics(userId: string): Promise<{
    recentQueries: QueryEvent[];
    topPatterns: QueryPattern[];
    suggestions: string[];
    totalQueries: number;
    averageResponseTime: number;
  }> {
    const recentQueries = await this.getRecentQueries(userId);
    const topPatterns = await this.getUserQueryPatterns(userId);
    const suggestions = this.generateBasicSuggestions(topPatterns);

    return {
      recentQueries: recentQueries.slice(0, 10),
      topPatterns: topPatterns.slice(0, 5),
      suggestions,
      totalQueries: recentQueries.length,
      averageResponseTime: recentQueries.reduce((sum, q) => sum + q.responseTime, 0) / Math.max(recentQueries.length, 1)
    };
  }

  private generateQueryId(): string {
    return `query-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private mapRowToQueryEvent(row: DatabaseRow): QueryEvent {
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
      followUpQueries: row.follow_up_queries ? [row.follow_up_queries] : undefined,
      taskCompleted: row.task_completed
    };
  }

  private generateBasicSuggestions(patterns: QueryPattern[]): string[] {
    // Simple suggestion generation based on successful patterns
    return patterns
      .filter(p => p.successRate > 0.7) // Only successful patterns
      .map(p => p.pattern)
      .slice(0, 5);
  }
}

/**
 * Session manager for tracking user search sessions
 */
export class SessionManager {
  private dbService: D1QueryService;
  private activeSessions = new Map<string, string>(); // userId -> sessionId

  constructor(dbService: D1QueryService) {
    this.dbService = dbService;
  }

  async getOrCreateSession(userId: string): Promise<string> {
    // Check for active session (within last 30 minutes)
    const activeSessionId = this.activeSessions.get(userId);
    if (activeSessionId && await this.isSessionActive(activeSessionId)) {
      return activeSessionId;
    }

    // Create new session
    const sessionId = this.generateSessionId();
    await this.createSession(sessionId, userId);
    this.activeSessions.set(userId, sessionId);
    
    return sessionId;
  }

  private async isSessionActive(sessionId: string): Promise<boolean> {
    try {
      const result = await this.dbService.query(`
        SELECT timestamp FROM query_events 
        WHERE session_id = ? 
        ORDER BY timestamp DESC 
        LIMIT 1
      `, [sessionId]);

      if (result.results.length === 0) return false;

      const lastActivity = new Date(result.results[0].timestamp);
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      
      return lastActivity > thirtyMinutesAgo;
    } catch (error) {
      return false;
    }
  }

  private async createSession(sessionId: string, userId: string): Promise<void> {
    try {
      await this.dbService.execute(`
        INSERT INTO query_sessions (id, user_id, start_time, status)
        VALUES (?, ?, ?, 'active')
      `, [sessionId, userId, new Date().toISOString()]);
    } catch (error) {
      // Log but don't throw - session creation failure shouldn't break search
      console.error('Failed to create session:', error);
    }
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
