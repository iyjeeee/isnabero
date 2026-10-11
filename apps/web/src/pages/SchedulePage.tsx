import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Copy, Users, CalendarCheck } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardContent, EmptyState, PageHeader, Skeleton, StatCard } from "@isnabero/ui";
import { addDays, formatHours, toYmd, useCopyWeek, useShifts, weekDays, weekStartOf } from "@isnabero/module-scheduling";
import { supabase } from "@/lib/supabase";
import { useBusinessStore } from "@/stores/business-store";
import { getCoreRepository } from "@/lib/repositories/get-repository";
import { usePermission } from "@/hooks/use-permission";
import { useAuth } from "@/providers/AuthProvider";
import { ExportButton } from "@/components/ExportButton";
import { shiftRows } from "@/lib/export-rows";
import { WeekGrid } from "@/components/schedule/WeekGrid";
import { ShiftModal, type ShiftEditorState } from "@/components/schedule/ShiftModal";
import { computeWeekStats } from "@/components/schedule/schedule-stats";

const formatDay = (ymd: string) => new Date(`${ymd}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" });

export default function SchedulePage() {
  const businessId = useBusinessStore((state) => state.businessId) ?? "";
  const canManage = usePermission("schedule.manage");
  const { employee: currentEmployee } = useAuth();
  const today = toYmd(new Date());

  const [weekStart, setWeekStart] = useState(() => weekStartOf(today));
  const [editor, setEditor] = useState<ShiftEditorState | null>(null);
  const days = useMemo(() => weekDays(weekStart), [weekStart]);

  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ["employees", businessId],
    queryFn: () => getCoreRepository(supabase).listEmployees(businessId),
    enabled: Boolean(businessId),
  });
  const { data: shifts = [], isLoading: shiftsLoading } = useShifts(supabase, businessId, { from: days[0] as string, to: days[6] as string });
  const copyWeek = useCopyWeek(supabase, businessId);
  const stats = useMemo(() => computeWeekStats(shifts), [shifts]);
  const isLoading = employeesLoading || shiftsLoading;
  const isThisWeek = weekStart === weekStartOf(today);
  const weekLabel = `${formatDay(days[0] as string)} – ${formatDay(days[6] as string)}, ${(days[6] as string).slice(0, 4)}`;

  const handleCopy = () =>
    copyWeek.mutate(
      { fromWeekStart: addDays(weekStart, -7), toWeekStart: weekStart },
      {
        onSuccess: ({ created, skipped }) => {
          if (created === 0 && skipped === 0) toast.info("Last week has no shifts to copy.");
          else toast.success(`Copied ${created} shift${created === 1 ? "" : "s"} from last week${skipped ? ` (${skipped} skipped: already scheduled)` : ""}`);
        },
      },
    );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CalendarDays}
        title="Staff Schedule"
        description={canManage ? "Plan who works when. Click a shift to edit it." : "Who is working this week."}
        action={
          <ExportButton
            title={`Schedule ${weekLabel}`}
            filenamePrefix={`schedule-${weekStart}`}
            hint="Exports the week shown."
            disabled={shifts.length === 0}
            buildRows={() => shiftRows(shifts, new Map(employees.map((item) => [item.id, item.fullName])), {})}
          />
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Shifts This Week" value={stats.shiftCount} icon={CalendarCheck} accent="default" isLoading={isLoading} />
        <StatCard label="Hours Scheduled" value={formatHours(stats.totalMinutes)} icon={Clock} accent="info" isLoading={isLoading} />
        <StatCard label="Staff Scheduled" value={`${stats.staffScheduled} of ${employees.length}`} icon={Users} accent="success" isLoading={isLoading} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Previous week" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" aria-label="Next week" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" disabled={isThisWeek} onClick={() => setWeekStart(weekStartOf(today))}>
            This week
          </Button>
          <h2 className="ml-1 font-display text-base font-semibold" aria-live="polite">
            {weekLabel}
          </h2>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCopy} disabled={copyWeek.isPending}>
              <Copy className="h-4 w-4" />
              {copyWeek.isPending ? "Copying…" : "Copy last week"}
            </Button>
            <Button onClick={() => setEditor({ mode: "add", date: days.includes(today) ? today : (days[0] as string) })}>Add shift</Button>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading && (
            <div className="space-y-3 p-5">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}
          {!isLoading && employees.length === 0 && <EmptyState icon={Users} title="No employees yet" description="Add employees first, then plan their shifts here." className="border-0" />}
          {!isLoading && employees.length > 0 && (
            <>
              <WeekGrid
                days={days}
                today={today}
                employees={employees}
                shifts={shifts}
                stats={stats}
                currentEmployeeId={currentEmployee?.id ?? null}
                canManage={canManage}
                onAdd={(employeeId, date) => setEditor({ mode: "add", employeeId, date })}
                onEdit={(shift) => setEditor({ mode: "edit", shift })}
              />
              {shifts.length === 0 && <p className="border-t px-4 py-3 text-sm text-muted-foreground">No shifts this week{canManage ? " — add one, or copy last week." : "."}</p>}
            </>
          )}
        </CardContent>
      </Card>

      <ShiftModal businessId={businessId} state={editor} employees={employees} onClose={() => setEditor(null)} />
    </div>
  );
}
