// Shared backend-mode helpers.
// In offline/self-hosted mode (Python API), VITE_API_URL is set.

export const VITE_API_URL = import.meta.env.VITE_API_URL;
export const USE_PYTHON_API = !!VITE_API_URL;

let cloudClient: any | null = null;

/**
 * Lazy-load the Lovable Cloud DB client.
 * IMPORTANT: Do not import the client at module scope in files that must work in offline mode.
 */
export async function getCloudClient() {
  if (!cloudClient) {
    const { supabase } = await import('@/integrations/supabase/client');
    cloudClient = supabase;
  }
  return cloudClient;
}
