/**
 * Database abstraction layer for dual-backend support
 * Use this instead of importing supabase directly in pages
 */
import { USE_PYTHON_API, getCloudClient } from '@/lib/backend';
import apiClient from '@/lib/api-client';

export interface QueryResult<T> {
  data: T | null;
  error: Error | null;
}

/**
 * Get the appropriate database client
 * Returns null in Python API mode (use apiClient instead)
 */
export async function getDb() {
  if (USE_PYTHON_API) {
    return null;
  }
  return getCloudClient();
}

/**
 * Execute a SELECT query that works in both modes
 */
export async function dbSelect<T>(
  apiPath: string,
  cloudQuery: (supabase: any) => Promise<{ data: T | null; error: any }>,
  params?: Record<string, any>
): Promise<QueryResult<T>> {
  if (USE_PYTHON_API) {
    return apiClient.get<T>(apiPath, params);
  }
  const supabase = await getCloudClient();
  const result = await cloudQuery(supabase);
  return {
    data: result.data,
    error: result.error ? new Error(result.error.message) : null,
  };
}

/**
 * Execute an INSERT query
 */
export async function dbInsert<T>(
  apiPath: string,
  cloudQuery: (supabase: any) => Promise<{ data: T | null; error: any }>,
  body: any
): Promise<QueryResult<T>> {
  if (USE_PYTHON_API) {
    return apiClient.post<T>(apiPath, body);
  }
  const supabase = await getCloudClient();
  const result = await cloudQuery(supabase);
  return {
    data: result.data,
    error: result.error ? new Error(result.error.message) : null,
  };
}

/**
 * Execute an UPDATE query
 */
export async function dbUpdate<T>(
  apiPath: string,
  cloudQuery: (supabase: any) => Promise<{ data: T | null; error: any }>,
  body: any
): Promise<QueryResult<T>> {
  if (USE_PYTHON_API) {
    return apiClient.put<T>(apiPath, body);
  }
  const supabase = await getCloudClient();
  const result = await cloudQuery(supabase);
  return {
    data: result.data,
    error: result.error ? new Error(result.error.message) : null,
  };
}

/**
 * Execute a DELETE query
 */
export async function dbDelete<T>(
  apiPath: string,
  cloudQuery: (supabase: any) => Promise<{ data: T | null; error: any }>
): Promise<QueryResult<T>> {
  if (USE_PYTHON_API) {
    return apiClient.delete<T>(apiPath);
  }
  const supabase = await getCloudClient();
  const result = await cloudQuery(supabase);
  return {
    data: result.data,
    error: result.error ? new Error(result.error.message) : null,
  };
}

/**
 * Check if we're in Python API mode
 */
export { USE_PYTHON_API } from '@/lib/backend';
export { apiClient } from '@/lib/api-client';