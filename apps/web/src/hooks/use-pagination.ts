import { useEffect, useState } from "react";

// usePagination: slices `items` into a page of `pageSize`. Resets to page 1 automatically if a filter
// change makes the current page go out of range (e.g. searching down to fewer results than fit on
// the current page).
export function usePagination<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  const pageItems = items.slice((page - 1) * pageSize, page * pageSize);

  return { page, setPage, totalPages, pageItems, totalItems: items.length, pageSize };
}
