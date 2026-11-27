import { useState, useEffect, useCallback, useRef } from 'react';

const EMPTY_FILTERS = Object.freeze({});

/**
 * Reusable Server-Side Data Table Hook (serverSide: true model for React)
 *
 * Centralizes server-driven pagination, page-size changes, debounced search,
 * multi-field filters, allowlisted column sorting, AbortController request
 * cancellation, monotonic stale-response protection, and consistent metadata
 * parsing (total_records vs filtered_records).
 */
export function useServerTable({
  fetcher,
  initialPerPage = 25,
  initialSortBy = 'created_at',
  initialSortDir = 'desc',
  initialFilters = EMPTY_FILTERS,
  debounceMs = 300,
  enabled = true,
}) {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({
    total: 0,
    total_records: 0,
    filtered_records: 0,
    page: 1,
    current_page: 1,
    per_page: initialPerPage,
    last_page: 1,
    total_pages: 1,
    sorting: { sort_by: initialSortBy, sort_dir: initialSortDir },
  });
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);

  const [page, setPageState] = useState(1);
  const [perPage, setPerPageState] = useState(initialPerPage);
  const [search, setSearchState] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortByState] = useState(initialSortBy);
  const [sortDir, setSortDirState] = useState(initialSortDir);
  const [filters, setFiltersState] = useState(initialFilters);
  const [refreshToken, setRefreshToken] = useState(0);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const initialFiltersRef = useRef(initialFilters);

  const requestSeqRef = useRef(0);
  const abortControllerRef = useRef(null);

  // Debounce search text only; explicit pagination, sorting, and refresh run immediately
  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed === debouncedSearch) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setDebouncedSearch(trimmed);
      setPageState(1);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [search, debouncedSearch, debounceMs]);

  const filtersKey = JSON.stringify(filters);

  const executeFetch = useCallback(() => {
    if (!enabled) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    abortControllerRef.current = controller;

    const currentSeq = ++requestSeqRef.current;
    setLoading(true);
    setError(null);

    const parsedFilters = JSON.parse(filtersKey);
    const params = {
      page,
      per_page: perPage,
      sort_by: sortBy,
      sort_dir: sortDir,
    };

    if (debouncedSearch) {
      params.search = debouncedSearch;
    }

    Object.entries(parsedFilters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params[k] = v;
      }
    });

    const callPromise = Promise.resolve(
      fetcherRef.current(params, controller ? { signal: controller.signal } : {})
    );

    callPromise
      .then((res) => {
        if (currentSeq !== requestSeqRef.current) return;

        const nextItems = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.items)
          ? res.items
          : Array.isArray(res?.data?.items)
          ? res.data.items
          : [];

        const rawMeta = res?.meta || res?.pagination || res?.data?.meta || res?.data?.pagination || {};
        const filteredCount = Number(
          rawMeta.filtered_records ?? rawMeta.total ?? rawMeta.total_items ?? nextItems.length
        );
        const totalCount = Number(rawMeta.total_records ?? filteredCount);
        const resolvedPerPage = Number(rawMeta.per_page ?? perPage) || perPage;
        const resolvedPage = Number(rawMeta.current_page ?? rawMeta.page ?? page) || 1;
        const resolvedPages = Number(
          rawMeta.total_pages ?? rawMeta.last_page ?? (filteredCount > 0 ? Math.ceil(filteredCount / resolvedPerPage) : 1)
        );

        setItems(nextItems);
        setMeta({
          ...rawMeta,
          total: filteredCount,
          total_records: totalCount,
          filtered_records: filteredCount,
          page: resolvedPage,
          current_page: resolvedPage,
          per_page: resolvedPerPage,
          last_page: resolvedPages,
          total_pages: resolvedPages,
          sorting: rawMeta.sorting || { sort_by: sortBy, sort_dir: sortDir },
        });
      })
      .catch((err) => {
        if (currentSeq !== requestSeqRef.current) return;
        if (err?.isCancelled || err?.name === 'AbortError') return;

        setItems([]);
        setError(err?.response?.data?.error?.message || err?.message || 'Failed to load table records.');
      })
      .finally(() => {
        if (currentSeq === requestSeqRef.current) {
          setLoading(false);
        }
      });
  }, [enabled, page, perPage, sortBy, sortDir, debouncedSearch, filtersKey, refreshToken]);

  useEffect(() => {
    executeFetch();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [executeFetch]);

  const setPage = useCallback((nextPage) => {
    setPageState((prev) => {
      const resolved = typeof nextPage === 'function' ? nextPage(prev) : nextPage;
      return Math.max(1, Number(resolved) || 1);
    });
  }, []);

  const setPerPage = useCallback((nextPerPage) => {
    const clamped = Math.max(1, Math.min(100, Number(nextPerPage) || initialPerPage));
    setPerPageState(clamped);
    setPageState(1);
  }, [initialPerPage]);

  const setSearch = useCallback((val) => {
    setSearchState(String(val ?? ''));
  }, []);

  const setFilter = useCallback((key, value) => {
    setFiltersState((prev) => ({ ...prev, [key]: value }));
    setPageState(1);
  }, []);

  const setFilters = useCallback((nextFilters) => {
    setFiltersState((prev) =>
      typeof nextFilters === 'function' ? nextFilters(prev) : nextFilters
    );
    setPageState(1);
  }, []);

  const toggleSort = useCallback((columnKey) => {
    setSortByState((prevCol) => {
      if (prevCol === columnKey) {
        setSortDirState((prevDir) => (prevDir === 'asc' ? 'desc' : 'asc'));
        return prevCol;
      }
      setSortDirState('asc');
      return columnKey;
    });
    setPageState(1);
  }, []);

  const resetFilters = useCallback(() => {
    setSearchState('');
    setDebouncedSearch('');
    setFiltersState(initialFiltersRef.current);
    setSortByState(initialSortBy);
    setSortDirState(initialSortDir);
    setPageState(1);
  }, [initialSortBy, initialSortDir]);

  const refresh = useCallback(() => {
    setRefreshToken((n) => n + 1);
  }, []);

  return {
    items,
    meta,
    loading,
    error,
    page,
    perPage,
    search,
    debouncedSearch,
    sortBy,
    sortDir,
    filters,
    setPage,
    setPerPage,
    setSearch,
    setFilter,
    setFilters,
    toggleSort,
    resetFilters,
    refresh,
  };
}

export default useServerTable;
