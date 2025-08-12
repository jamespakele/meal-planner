/**
 * Monitored Supabase client wrapper that tracks all database operations
 * Provides automatic monitoring for performance and error tracking
 */

import { getSupabaseClient } from './singleton'
import { monitorOperation, recordError } from './monitoring'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

type Tables = Database['public']['Tables']
type TableName = keyof Tables

/**
 * Monitored wrapper for Supabase client operations
 * Automatically tracks performance and errors
 */
class MonitoredSupabaseClient {
  private client: SupabaseClient<Database>

  constructor() {
    this.client = getSupabaseClient()
  }

  /**
   * Get monitored table operations
   */
  from<T extends TableName>(table: T) {
    return new MonitoredTableClient(this.client.from(table), table as string)
  }

  /**
   * Get monitored auth operations
   */
  get auth() {
    return new MonitoredAuthClient(this.client.auth)
  }

  /**
   * Get raw client (use sparingly, bypasses monitoring)
   */
  get raw() {
    return this.client
  }

  /**
   * Execute monitored RPC call
   */
  async rpc(functionName: string, parameters?: any) {
    return monitorOperation(`rpc-${functionName}`, async () => {
      try {
        const result = await this.client.rpc(functionName as any, parameters)
        if (result.error) {
          throw new Error(result.error.message)
        }
        return result
      } catch (error) {
        recordError(`rpc-${functionName}`, error as Error)
        throw error
      }
    })
  }
}

/**
 * Monitored wrapper for table operations
 */
class MonitoredTableClient<T extends TableName> {
  constructor(
    private tableClient: any,
    private tableName: string
  ) {}

  /**
   * Monitored select operation
   */
  select(columns?: string) {
    return new MonitoredQueryBuilder(
      this.tableClient.select(columns),
      `${this.tableName}-select`,
      this.tableName
    )
  }

  /**
   * Monitored insert operation
   */
  async insert(values: any) {
    return monitorOperation(`${this.tableName}-insert`, async () => {
      try {
        const result = await this.tableClient.insert(values)
        if (result.error) {
          throw new Error(result.error.message)
        }
        return result
      } catch (error) {
        recordError(`${this.tableName}-insert`, error as Error)
        throw error
      }
    })
  }

  /**
   * Monitored update operation
   */
  update(values: any) {
    return new MonitoredQueryBuilder(
      this.tableClient.update(values),
      `${this.tableName}-update`,
      this.tableName
    )
  }

  /**
   * Monitored delete operation
   */
  delete() {
    return new MonitoredQueryBuilder(
      this.tableClient.delete(),
      `${this.tableName}-delete`,
      this.tableName
    )
  }

  /**
   * Monitored upsert operation
   */
  async upsert(values: any, options?: any) {
    return monitorOperation(`${this.tableName}-upsert`, async () => {
      try {
        const result = await this.tableClient.upsert(values, options)
        if (result.error) {
          throw new Error(result.error.message)
        }
        return result
      } catch (error) {
        recordError(`${this.tableName}-upsert`, error as Error)
        throw error
      }
    })
  }
}

/**
 * Monitored wrapper for query builder operations
 */
class MonitoredQueryBuilder {
  constructor(
    private queryBuilder: any,
    private operationType: string,
    private tableName: string
  ) {}

  // Filtering methods that return new MonitoredQueryBuilder
  eq(column: string, value: any) {
    return new MonitoredQueryBuilder(
      this.queryBuilder.eq(column, value),
      this.operationType,
      this.tableName
    )
  }

  neq(column: string, value: any) {
    return new MonitoredQueryBuilder(
      this.queryBuilder.neq(column, value),
      this.operationType,
      this.tableName
    )
  }

  gt(column: string, value: any) {
    return new MonitoredQueryBuilder(
      this.queryBuilder.gt(column, value),
      this.operationType,
      this.tableName
    )
  }

  gte(column: string, value: any) {
    return new MonitoredQueryBuilder(
      this.queryBuilder.gte(column, value),
      this.operationType,
      this.tableName
    )
  }

  lt(column: string, value: any) {
    return new MonitoredQueryBuilder(
      this.queryBuilder.lt(column, value),
      this.operationType,
      this.tableName
    )
  }

  lte(column: string, value: any) {
    return new MonitoredQueryBuilder(
      this.queryBuilder.lte(column, value),
      this.operationType,
      this.tableName
    )
  }

  like(column: string, pattern: string) {
    return new MonitoredQueryBuilder(
      this.queryBuilder.like(column, pattern),
      this.operationType,
      this.tableName
    )
  }

  ilike(column: string, pattern: string) {
    return new MonitoredQueryBuilder(
      this.queryBuilder.ilike(column, pattern),
      this.operationType,
      this.tableName
    )
  }

  in(column: string, values: any[]) {
    return new MonitoredQueryBuilder(
      this.queryBuilder.in(column, values),
      this.operationType,
      this.tableName
    )
  }

  contains(column: string, value: any) {
    return new MonitoredQueryBuilder(
      this.queryBuilder.contains(column, value),
      this.operationType,
      this.tableName
    )
  }

  containedBy(column: string, value: any) {
    return new MonitoredQueryBuilder(
      this.queryBuilder.containedBy(column, value),
      this.operationType,
      this.tableName
    )
  }

  // Modifier methods
  order(column: string, options?: any) {
    return new MonitoredQueryBuilder(
      this.queryBuilder.order(column, options),
      this.operationType,
      this.tableName
    )
  }

  limit(count: number) {
    return new MonitoredQueryBuilder(
      this.queryBuilder.limit(count),
      this.operationType,
      this.tableName
    )
  }

  range(from: number, to: number) {
    return new MonitoredQueryBuilder(
      this.queryBuilder.range(from, to),
      this.operationType,
      this.tableName
    )
  }

  single() {
    return new MonitoredQueryBuilder(
      this.queryBuilder.single(),
      this.operationType,
      this.tableName
    )
  }

  maybeSingle() {
    return new MonitoredQueryBuilder(
      this.queryBuilder.maybeSingle(),
      this.operationType,
      this.tableName
    )
  }

  // Execution methods
  async then(resolve?: any, reject?: any) {
    return monitorOperation(this.operationType, async () => {
      try {
        const result = await this.queryBuilder
        if (result.error) {
          throw new Error(result.error.message)
        }
        return result
      } catch (error) {
        recordError(this.operationType, error as Error)
        throw error
      }
    }).then(resolve, reject)
  }

  // For async/await support
  async [Symbol.toStringTag]() {
    return this.then()
  }
}

/**
 * Monitored wrapper for auth operations
 */
class MonitoredAuthClient {
  constructor(private authClient: any) {}

  async getSession() {
    return monitorOperation('auth-getSession', async () => {
      try {
        const result = await this.authClient.getSession()
        if (result.error) {
          throw new Error(result.error.message)
        }
        return result
      } catch (error) {
        recordError('auth-getSession', error as Error)
        throw error
      }
    })
  }

  async signInWithOAuth(credentials: any) {
    return monitorOperation('auth-signInWithOAuth', async () => {
      try {
        const result = await this.authClient.signInWithOAuth(credentials)
        if (result.error) {
          throw new Error(result.error.message)
        }
        return result
      } catch (error) {
        recordError('auth-signInWithOAuth', error as Error)
        throw error
      }
    })
  }

  async signOut() {
    return monitorOperation('auth-signOut', async () => {
      try {
        const result = await this.authClient.signOut()
        if (result.error) {
          throw new Error(result.error.message)
        }
        return result
      } catch (error) {
        recordError('auth-signOut', error as Error)
        throw error
      }
    })
  }

  onAuthStateChange(callback: any) {
    // Note: Not monitoring state change listeners as they're passive
    return this.authClient.onAuthStateChange(callback)
  }

  // Get raw auth client for other operations
  get raw() {
    return this.authClient
  }
}

// Export singleton monitored client
export const supabase = new MonitoredSupabaseClient()

// Export for direct usage
export { MonitoredSupabaseClient, MonitoredTableClient, MonitoredQueryBuilder, MonitoredAuthClient }