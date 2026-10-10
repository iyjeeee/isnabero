// PageFallback: shared Suspense fallback for lazy-loaded pages (used by App.tsx for the login route and by
// AppLayout so the sidebar stays mounted while a page chunk loads)
export function PageFallback() {
  return <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">Loading…</div>;
}
