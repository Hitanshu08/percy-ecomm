import { useState, useCallback } from 'react';
import { apiCall } from '../api';

interface ApiResponse<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApi<T = any>() {
  const [state, setState] = useState<ApiResponse<T>>({
    data: null,
    loading: false,
    error: null
  });

  const callApi = useCallback(async <R = T>(
    url: string, 
    options: RequestInit = {}
  ): Promise<R> => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const data = await apiCall<R>(url, options);
      setState({ data: data as T, loading: false, error: null });
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      setState({ data: null, loading: false, error: errorMessage });
      throw error;
    }
  }, []);

  return { ...state, callApi };
} 