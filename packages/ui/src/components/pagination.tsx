import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
import { useUiLabels } from "./ui-labels";

export interface PaginationProps {
  page: number; // 1-indexed
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
}

// Pagination: prev/next controls + "Showing X-Y of Z" label. Used by any table/grid page instead of
// each one building its own paging controls.
export function Pagination({ page, totalPages, onPageChange, totalItems, pageSize }: PaginationProps) {
  const labels = useUiLabels();
  if (totalPages <= 1) return null;

  const rangeStart = totalItems && pageSize ? (page - 1) * pageSize + 1 : undefined;
  const rangeEnd = totalItems && pageSize ? Math.min(page * pageSize, totalItems) : undefined;

  return (
    <div className="flex items-center justify-between px-1 py-2 text-sm text-muted-foreground">
      <span>
        {rangeStart !== undefined && rangeEnd !== undefined && totalItems !== undefined
          ? labels.showingRange(rangeStart, rangeEnd, totalItems)
          : labels.pageOf(page, totalPages)}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
          {labels.prev}
        </Button>
        <span className="tabular-nums">
          {page} / {totalPages}
        </span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          {labels.next}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
