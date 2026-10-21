import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useSetupDialogStore } from "@/stores/setup-dialog-store";

// SetupRedirect: Business Setup used to be the /app/setup page; old links and bookmarks now land on the dashboard with the modal open
export function SetupRedirect() {
  const setOpen = useSetupDialogStore((state) => state.setOpen);
  useEffect(() => setOpen(true), [setOpen]);
  return <Navigate to="/app" replace />;
}
