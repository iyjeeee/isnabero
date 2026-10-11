import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSchedulingRepository } from "./get-repository";
import type { CopyWeekInput, ListShiftsOptions, ShiftInput, UpdateShiftInput } from "./types";

// useShifts: shifts for a business between two dates (inclusive), by date then start time
export function useShifts(supabase: SupabaseClient, businessId: string, range: ListShiftsOptions) {
  const repository = getSchedulingRepository(supabase);
  return useQuery({
    queryKey: ["shifts", businessId, range.from, range.to],
    queryFn: () => repository.listShifts(businessId, range),
    enabled: Boolean(businessId),
  });
}

// Every mutation refreshes all cached weeks and the audit log (a shift change is audited)
function useShiftMutation<TInput>(businessId: string, run: (input: TInput) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts", businessId] });
      queryClient.invalidateQueries({ queryKey: ["audit_log", businessId] });
    },
  });
}

export function useCreateShift(supabase: SupabaseClient, businessId: string) {
  const repository = getSchedulingRepository(supabase);
  return useShiftMutation(businessId, (input: ShiftInput) => repository.createShift(businessId, input));
}

export function useUpdateShift(supabase: SupabaseClient, businessId: string) {
  const repository = getSchedulingRepository(supabase);
  return useShiftMutation(businessId, ({ shiftId, input }: { shiftId: string; input: UpdateShiftInput }) => repository.updateShift(businessId, shiftId, input));
}

export function useDeleteShift(supabase: SupabaseClient, businessId: string) {
  const repository = getSchedulingRepository(supabase);
  return useShiftMutation(businessId, (shiftId: string) => repository.deleteShift(businessId, shiftId));
}

export function useCopyWeek(supabase: SupabaseClient, businessId: string) {
  const repository = getSchedulingRepository(supabase);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CopyWeekInput) => repository.copyWeek(businessId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts", businessId] });
      queryClient.invalidateQueries({ queryKey: ["audit_log", businessId] });
    },
  });
}
