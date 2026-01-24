import { useState, useMemo, useCallback } from 'react';

interface UseTableFiltersOptions<T> {
  data: T[];
  searchFields: (keyof T | ((item: T) => string | null | undefined))[];
  initialPageSize?: number;
}

interface UseTableFiltersReturn<T> {
  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  
  // Filters
  filters: Record<string, string>;
  setFilter: (key: string, value: string) => void;
  resetFilters: () => void;
  
  // Pagination
  currentPage: number;
  setCurrentPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  totalPages: number;
  
  // Data
  filteredData: T[];
  paginatedData: T[];
  totalCount: number;
  
  // Display helpers
  showingFrom: number;
  showingTo: number;
}

export function useTableFilters<T>({
  data,
  searchFields,
  initialPageSize = 10,
}: UseTableFiltersOptions<T>): UseTableFiltersReturn<T> {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const setFilter = useCallback((key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page when filter changes
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({});
    setSearchQuery('');
    setCurrentPage(1);
  }, []);

  const handleSetSearchQuery = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1); // Reset to first page when search changes
  }, []);

  const handleSetPageSize = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page when page size changes
  }, []);

  const filteredData = useMemo(() => {
    let result = [...data];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((item) =>
        searchFields.some((field) => {
          let value: string | null | undefined;
          if (typeof field === 'function') {
            value = field(item);
          } else {
            value = item[field] as string | null | undefined;
          }
          return value?.toString().toLowerCase().includes(query);
        })
      );
    }

    // Apply custom filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== 'all') {
        result = result.filter((item) => {
          const itemValue = (item as Record<string, any>)[key];
          return itemValue === value;
        });
      }
    });

    return result;
  }, [data, searchQuery, filters, searchFields]);

  const totalPages = Math.ceil(filteredData.length / pageSize);
  const totalCount = filteredData.length;

  // Ensure current page is valid
  const validCurrentPage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages));
  if (validCurrentPage !== currentPage) {
    setCurrentPage(validCurrentPage);
  }

  const paginatedData = useMemo(() => {
    const start = (validCurrentPage - 1) * pageSize;
    const end = start + pageSize;
    return filteredData.slice(start, end);
  }, [filteredData, validCurrentPage, pageSize]);

  const showingFrom = filteredData.length > 0 ? (validCurrentPage - 1) * pageSize + 1 : 0;
  const showingTo = Math.min(validCurrentPage * pageSize, filteredData.length);

  return {
    searchQuery,
    setSearchQuery: handleSetSearchQuery,
    filters,
    setFilter,
    resetFilters,
    currentPage: validCurrentPage,
    setCurrentPage,
    pageSize,
    setPageSize: handleSetPageSize,
    totalPages,
    filteredData,
    paginatedData,
    totalCount,
    showingFrom,
    showingTo,
  };
}
