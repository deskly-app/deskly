import { useState, useEffect, useCallback, useRef } from "react";
import { fetchWithTimeout } from "@/lib/utils";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  [key: string]: unknown;
}

export interface UseOfflineDataOptions<T> {
  /** localStorage key to read/write cache */
  cacheKey: string;
  /** Async function that returns an ApiResponse-shaped object */
  fetcher: () => Promise<ApiResponse<T>>;
  /** Only fetch when true — e.g. isLoggedIn && !authLoading */
  enabled?: boolean;
  /** Timeout in ms (default: 15000) */
  timeout?: number;
  /** Optional: filter or transform raw data before storing */
  transform?: (raw: T) => T;
  /** Optional: check if cached value is non-empty (default: truthy check) */
  isEmpty?: (value: T) => boolean;
}

export interface UseOfflineDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** True when showing cached data but last fetch failed */
  isStale: boolean;
  /** Manually trigger a re-fetch */
  retry: () => void;
}

function readCache<T>(cacheKey: string): T | null {
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) return JSON.parse(raw) as T;
  } catch {}
  return null;
}

function writeCache<T>(cacheKey: string, value: T): void {
  try {
    localStorage.setItem(cacheKey, JSON.stringify(value));
  } catch {}
}

export function useOfflineData<T>({
  cacheKey,
  fetcher,
  enabled = true,
  timeout = 15000,
  transform,
  isEmpty,
}: UseOfflineDataOptions<T>): UseOfflineDataResult<T> {
  const hasData = (value: T | null): boolean => {
    if (value === null || value === undefined) return false;
    if (isEmpty) return !isEmpty(value);
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(value as object).length > 0;
    return !!value;
  };

  const [data, setData] = useState<T | null>(() => readCache<T>(cacheKey));
  const [loading, setLoading] = useState<boolean>(() => !hasData(readCache<T>(cacheKey)));
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);

  // Use ref to avoid stale closure issues in fetch
  const dataRef = useRef(data);
  dataRef.current = data;

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    const currentData = dataRef.current;
    const hasCache = hasData(currentData);

    setError(null);
    setLoading(!hasCache);

    try {
      const res = await fetchWithTimeout(fetcher(), timeout);

      if (res?.success && res.data !== undefined && res.data !== null) {
        const processed = transform ? transform(res.data) : res.data;
        setData(processed);
        writeCache(cacheKey, processed);
        setIsStale(false);
        setError(null);
      } else {
        const errMsg = res?.error ?? "Failed to fetch data.";
        if (!hasCache) {
          setError(errMsg);
        } else {
          // silently mark stale — still showing cached data
          setIsStale(true);
        }
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      if (!hasCache) {
        setError(errMsg);
      } else {
        setIsStale(true);
      }
    } finally {
      setLoading(false);
    }
  }, [enabled, cacheKey, timeout]);

  useEffect(() => {
    if (enabled) {
      fetchData();
    }
  }, [enabled]);

  const retry = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, isStale, retry };
}
