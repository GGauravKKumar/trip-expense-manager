import { useEffect, useState } from 'react';
import { USE_PYTHON_API, getCloudClient } from '@/lib/backend';
import { apiClient } from '@/lib/api-client';
import logoFallback from '@/assets/logo.jpg';

/**
 * Fetches the company_logo_url from admin_settings.
 * Falls back to the bundled logo.jpg when no URL is configured.
 */
export function useCompanyLogo() {
  const [logoUrl, setLogoUrl] = useState<string>(logoFallback);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      try {
        if (USE_PYTHON_API) {
          const { data } = await apiClient.get<{ key: string; value: string }[]>('/settings');
          if (!cancelled && data) {
            const row = data.find((r) => r.key === 'company_logo_url');
            if (row?.value) setLogoUrl(row.value);
          }
        } else {
          const supabase = await getCloudClient();
          const { data } = await supabase
            .from('admin_settings')
            .select('value')
            .eq('key', 'company_logo_url')
            .maybeSingle();
          if (!cancelled && data?.value) setLogoUrl(data.value);
        }
      } catch {
        // keep fallback
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, []);

  return logoUrl;
}
