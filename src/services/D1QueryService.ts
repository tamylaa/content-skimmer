/**
 * D1 Database Service for Query Learning
 * 
 * Handles direct database operations for storing and retrieving query data.
 */

export interface D1QueryResult {
  results: any[];
  success: boolean;
  meta?: any;
}

export class D1QueryService {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async query(sql: string, params: any[] = []): Promise<D1QueryResult> {
    try {
      const result = await this.db.prepare(sql).bind(...params).all();
      return {
        results: result.results || [],
        success: result.success,
        meta: result.meta
      };
    } catch (error) {
      console.error('D1 Query Error:', error);
      return {
        results: [],
        success: false
      };
    }
  }

  async execute(sql: string, params: any[] = []): Promise<D1QueryResult> {
    try {
      const result = await this.db.prepare(sql).bind(...params).run();
      return {
        results: [],
        success: result.success,
        meta: result.meta
      };
    } catch (error) {
      console.error('D1 Execute Error:', error);
      return {
        results: [],
        success: false
      };
    }
  }

  async initializeSchema(): Promise<boolean> {
    const schema = `
      -- Query Events Table
      CREATE TABLE IF NOT EXISTS query_events (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        query_text TEXT NOT NULL,
        search_engine TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        result_count INTEGER NOT NULL,
        response_time INTEGER NOT NULL,
        results_clicked TEXT, -- JSON array
        follow_up_queries TEXT,
        task_completed BOOLEAN DEFAULT FALSE
      );

      CREATE INDEX IF NOT EXISTS idx_query_user_timestamp ON query_events(user_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_query_session ON query_events(session_id);
      CREATE INDEX IF NOT EXISTS idx_query_text ON query_events(query_text);

      -- Query Sessions Table
      CREATE TABLE IF NOT EXISTS query_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME,
        status TEXT DEFAULT 'active', -- 'active', 'completed', 'abandoned'
        task_context TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_session_user ON query_sessions(user_id, start_time);

      -- Query Patterns Table (for caching computed patterns)
      CREATE TABLE IF NOT EXISTS query_patterns (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        pattern_text TEXT NOT NULL,
        frequency INTEGER NOT NULL,
        success_rate REAL NOT NULL,
        avg_response_time REAL NOT NULL,
        last_updated DATETIME NOT NULL,
        
        UNIQUE(user_id, pattern_text)
      );

      CREATE INDEX IF NOT EXISTS idx_patterns_user ON query_patterns(user_id, frequency DESC);
    `;

    try {
      // Split schema into individual statements
      const statements = schema
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const statement of statements) {
        await this.execute(statement);
      }

      return true;
    } catch (error) {
      console.error('Failed to initialize query learning schema:', error);
      return false;
    }
  }
}
