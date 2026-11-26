import { useMemo, useState } from 'react';

/**
 * Client-side pagination state helper (not used for server pagination,
 * which is handled by page/limit in filters). This is for local lists.
 */
export function usePagination(rows = [], pageSize = 10) {
  const [page, setPage] = useState(1);
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const data = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  return { data, page, pages, setPage, total };
}