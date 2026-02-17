import { useState, useCallback, useRef, useEffect } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';

export const DEFAULT_PAGE_SIZE = 50;

export interface PaginatedResult<T> {
  data: T[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  total: number;
}

/**
 * usePaginatedQuery — Generic Supabase pagination hook
 * 
 * Usage:
 * ```ts
 * const { data, loading, hasMore, loadMore, refresh } = usePaginatedQuery(
 *   supabase,
 *   'tasks',
 *   'id, title, status, created_at',
 *   { 
 *     filters: [{ column: 'project_id', op: 'eq', value: projectId }],
 *     orderBy: { column: 'created_at', ascending: false },
 *     pageSize: 50 
 *   }
 * );
 * ```
 */

interface Filter {
  column: string;
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'is';
  value: any;
}

interface PaginatedQueryOptions {
  filters?: Filter[];
  orderBy?: { column: string; ascending?: boolean };
  pageSize?: number;
  enabled?: boolean;
}

export function usePaginatedQuery<T = any>(
  client: SupabaseClient,
  table: string,
  columns: string,
  options: PaginatedQueryOptions = {}
): PaginatedResult<T> {
  const {
    filters = [],
    orderBy = { column: 'created_at', ascending: false },
    pageSize = DEFAULT_PAGE_SIZE,
    enabled = true,
  } = options;

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const offsetRef = useRef(0);

  const buildQuery = useCallback(
    (from: number, to: number) => {
      let query = client
        .from(table)
        .select(columns, { count: 'exact' });

      for (const filter of filters) {
        switch (filter.op) {
          case 'eq':   query = query.eq(filter.column, filter.value); break;
          case 'neq':  query = query.neq(filter.column, filter.value); break;
          case 'gt':   query = query.gt(filter.column, filter.value); break;
          case 'gte':  query = query.gte(filter.column, filter.value); break;
          case 'lt':   query = query.lt(filter.column, filter.value); break;
          case 'lte':  query = query.lte(filter.column, filter.value); break;
          case 'in':   query = query.in(filter.column, filter.value); break;
          case 'is':   query = query.is(filter.column, filter.value); break;
        }
      }

      query = query.order(orderBy.column, { ascending: orderBy.ascending ?? false });
      query = query.range(from, to);

      return query;
    },
    [client, table, columns, JSON.stringify(filters), orderBy.column, orderBy.ascending]
  );

  const fetchPage = useCallback(
    async (isRefresh = false) => {
      if (!enabled) return;

      if (isRefresh) {
        setLoading(true);
        offsetRef.current = 0;
      } else {
        setLoadingMore(true);
      }

      try {
        const from = isRefresh ? 0 : offsetRef.current;
        const to = from + pageSize - 1;

        const { data: pageData, error: queryError, count } = await buildQuery(from, to);

        if (queryError) throw queryError;

        const newData = (pageData || []) as T[];
        
        if (isRefresh) {
          setData(newData);
        } else {
          setData(prev => [...prev, ...newData]);
        }

        offsetRef.current = from + newData.length;
        setHasMore(newData.length === pageSize);
        if (count !== null) setTotal(count);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to load data');
        console.error(`Paginated query error on ${table}:`, err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [buildQuery, enabled, pageSize, table]
  );

  const loadMore = useCallback(async () => {
    if (!loadingMore && hasMore) {
      await fetchPage(false);
    }
  }, [fetchPage, loadingMore, hasMore]);

  const refresh = useCallback(async () => {
    await fetchPage(true);
  }, [fetchPage]);

  // Initial load
  useEffect(() => {
    if (enabled) {
      fetchPage(true);
    }
  }, [fetchPage, enabled]);

  return { data, loading, loadingMore, hasMore, error, loadMore, refresh, total };
}
