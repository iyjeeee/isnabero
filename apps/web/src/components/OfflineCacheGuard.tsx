import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import { claimCacheForUser, clearOfflineCache } from "@/lib/offline/query-persistence";

// OfflineCacheGuard: the saved offline data only ever belongs to the signed-in user; signing out or switching user wipes it
export function OfflineCacheGuard() {
  const { user, loading } = useAuth();
  const client = useQueryClient();

  useEffect(() => {
    if (loading) return;
    if (user) claimCacheForUser(client, user.id);
    else clearOfflineCache(client);
  }, [user, loading, client]);

  return null;
}
