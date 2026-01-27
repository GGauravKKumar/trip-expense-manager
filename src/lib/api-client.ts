/**
 * API Client for Python Backend
 * Replaces Supabase client for offline/self-hosted deployment
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const TOKEN_KEY = 'busmanager_token';
const USER_KEY = 'busmanager_user';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'driver' | 'repair_org';
  profile_id: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

class ApiClient {
  private token: string | null = null;
  private user: User | null = null;
  private authChangeCallbacks: ((user: User | null) => void)[] = [];

  constructor() {
    // Load from localStorage
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem(TOKEN_KEY);
      const userStr = localStorage.getItem(USER_KEY);
      if (userStr) {
        try {
          this.user = JSON.parse(userStr);
        } catch {
          this.user = null;
        }
      }
    }
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    customHeaders?: HeadersInit
  ): Promise<{ data: T | null; error: Error | null }> {
    try {
      const response = await fetch(`${API_URL}${path}`, {
        method,
        headers: { ...this.getHeaders(), ...customHeaders },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  // Auth methods
  async signIn(email: string, password: string): Promise<{ error: Error | null }> {
    const { data, error } = await this.request<AuthResponse>('POST', '/auth/login', {
      email,
      password,
    });

    if (error) {
      return { error };
    }

    if (data) {
      this.token = data.access_token;
      this.user = data.user;
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      this.notifyAuthChange(data.user);
    }

    return { error: null };
  }

  async signUp(email: string, password: string, fullName: string): Promise<{ error: Error | null }> {
    const { data, error } = await this.request<AuthResponse>('POST', '/auth/signup', {
      email,
      password,
      full_name: fullName,
    });

    if (error) {
      return { error };
    }

    if (data) {
      this.token = data.access_token;
      this.user = data.user;
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      this.notifyAuthChange(data.user);
    }

    return { error: null };
  }

  async signOut(): Promise<void> {
    this.token = null;
    this.user = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.notifyAuthChange(null);
  }

  async getSession(): Promise<{ user: User | null }> {
    if (!this.token) {
      return { user: null };
    }

    // Verify token is still valid
    const { data, error } = await this.request<User>('GET', '/auth/me');
    if (error) {
      await this.signOut();
      return { user: null };
    }

    this.user = data;
    if (data) {
      localStorage.setItem(USER_KEY, JSON.stringify(data));
    }
    return { user: data };
  }

  getUser(): User | null {
    return this.user;
  }

  getToken(): string | null {
    return this.token;
  }

  onAuthStateChange(callback: (user: User | null) => void): () => void {
    this.authChangeCallbacks.push(callback);
    // Call immediately with current state
    callback(this.user);
    // Return unsubscribe function
    return () => {
      this.authChangeCallbacks = this.authChangeCallbacks.filter(cb => cb !== callback);
    };
  }

  private notifyAuthChange(user: User | null): void {
    this.authChangeCallbacks.forEach(cb => cb(user));
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ error: Error | null }> {
    const { error } = await this.request('POST', '/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return { error };
  }

  // Generic CRUD methods
  async get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<{ data: T | null; error: Error | null }> {
    let url = path;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }
    return this.request<T>('GET', url);
  }

  async post<T>(path: string, body: unknown): Promise<{ data: T | null; error: Error | null }> {
    return this.request<T>('POST', path, body);
  }

  async put<T>(path: string, body: unknown): Promise<{ data: T | null; error: Error | null }> {
    return this.request<T>('PUT', path, body);
  }

  async delete<T>(path: string): Promise<{ data: T | null; error: Error | null }> {
    return this.request<T>('DELETE', path);
  }

  // File upload
  async uploadFile(
    type: 'expense' | 'repair',
    file: File
  ): Promise<{ data: { url: string } | null; error: Error | null }> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/upload/${type}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return { data: { url: `${API_URL}${data.url}` }, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  // Helper to get full file URL
  getFileUrl(path: string): string {
    if (path.startsWith('http')) {
      return path;
    }
    return `${API_URL}${path}`;
  }
}

// Singleton instance
export const apiClient = new ApiClient();

// Export for use in components
export default apiClient;
