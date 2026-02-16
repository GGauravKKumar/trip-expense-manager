// Shared backend-mode helpers.
// In offline/self-hosted mode (Python API), VITE_API_URL is set.

export const VITE_API_URL = import.meta.env.VITE_API_URL;
export const USE_PYTHON_API = !!VITE_API_URL;

let cloudClient: any | null = null;

/**
 * Lazy-load the cloud DB client.
 * IMPORTANT: Do not import the client at module scope in files that must work in offline mode.
 */
export async function getCloudClient() {
  if (!cloudClient) {
    const { supabase } = await import('@/integrations/supabase/client');
    cloudClient = supabase;
  }
  return cloudClient;
}

/**
 * Helper type for Supabase-like response
 */
export interface DataResponse<T> {
  data: T | null;
  error: Error | null;
}

/**
 * Execute a database query that works in both Python API and Cloud modes.
 * For Python mode, pass the apiPath. For Cloud mode, pass the queryFn.
 */
export async function dbQuery<T>(
  apiPath: string,
  cloudQueryFn: (client: any) => Promise<{ data: T | null; error: any }>
): Promise<DataResponse<T>> {
  if (USE_PYTHON_API) {
    const { apiClient } = await import('@/lib/api-client');
    return apiClient.get<T>(apiPath);
  } else {
    const client = await getCloudClient();
    const result = await cloudQueryFn(client);
    return {
      data: result.data,
      error: result.error ? new Error(result.error.message || 'Query failed') : null,
    };
  }
}
