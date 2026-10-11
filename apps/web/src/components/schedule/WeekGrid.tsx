import { Plus } from "lucide-react";
import { Badge, cn } from "@isnabero/ui";
import { formatClock, formatClockShort, formatHours, type Shift } from "@isnabero/module-scheduling";
import type { EmployeeView } from "@/lib/repositories/repository";
import type { WeekStats } from "./schedule-stats";

interface WeekGridProps {
  days: string[]; // 7 YYYY-MM-DD, Monday first
  today: string;
  employees: EmployeeView[];
  shifts: Shift[];
  stats: WeekStats;
  currentEmployeeId: string | null; // gets a "You" badge
  canManage: boolean;
  onAdd: (employeeId: string, date: string) => void;
  onEdit: (shift: Shift) => void;
}

const dayParts = (ymd: string) => {
  const date = new Date(`${ymd}T00:00:00`);
  return { weekday: date.toLocaleDateString("en-PH", { weekday: "short" }), short: date.toLocaleDateString("en-PH", { month: "short", day: "numeric" }) };
};

// WeekGrid: employees down the side, Monday–Sunday across. Scrolls sideways inside its card on small screens (the first
// column stays put). Owners/admins get click-to-edit shifts and an add button per cell; staff just read.
export function WeekGrid({ days, today, employees, shifts, stats, currentEmployeeId, canManage, onAdd, onEdit }: WeekGridProps) {
  const shiftsFor = (employeeId: string, day: string) => shifts.filter((shift) => shift.employeeId === employeeId && shift.shiftDate === day);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[56rem] table-fixed border-collapse text-sm">
        <thead className="border-b bg-muted/50 text-left text-muted-foreground">
          <tr>
            <th scope="col" className="sticky left-0 z-10 w-40 bg-muted px-4 py-3 font-medium">
              Employee
            </th>
            {days.map((day) => {
              const { weekday, short } = dayParts(day);
              const working = stats.staffByDay.get(day) ?? 0;
              return (
                <th key={day} scope="col" className={cn("px-2 py-3 font-medium", day === today && "bg-primary/10 text-primary")}>
                  <div className="whitespace-nowrap">
                    {weekday} <span className="font-normal">{short}</span>
                  </div>
                  <div className="text-xs font-normal">{working === 0 ? "No one" : `${working} working`}</div>
                </th>
              );
            })}
            <th scope="col" className="w-20 px-4 py-3 text-right font-medium">
              Hours
            </th>
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.id} className="border-b last:border-0 align-top">
              <th scope="row" className="sticky left-0 z-10 bg-card px-4 py-3 text-left font-medium">
                <div className="flex flex-wrap items-center gap-2">
                  {employee.fullName}
                  {employee.id === currentEmployeeId && <Badge variant="info">You</Badge>}
                </div>
                <div className="text-xs font-normal capitalize text-muted-foreground">{employee.role}</div>
              </th>
              {days.map((day) => {
                const cellShifts = shiftsFor(employee.id, day);
                return (
                  <td key={day} className={cn("px-1.5 py-2", day === today && "bg-primary/5")}>
                    <div className="flex flex-col gap-1">
                      {cellShifts.map((shift) => {
                        const label = `${formatClock(shift.startTime)} – ${formatClock(shift.endTime)}`; // full wording for screen readers and tooltips
                        const shortLabel = `${formatClockShort(shift.startTime)} – ${formatClockShort(shift.endTime)}`;
                        const content = (
                          <>
                            <span className="block whitespace-nowrap font-medium">{shortLabel}</span>
                            {shift.note && <span className="block truncate text-xs opacity-75">{shift.note}</span>}
                          </>
                        );
                        return canManage ? (
                          <button
                            key={shift.id}
                            type="button"
                            onClick={() => onEdit(shift)}
                            aria-label={`Edit ${employee.fullName}'s shift on ${dayParts(day).weekday} ${dayParts(day).short}, ${label}`}
                            title={shift.note ? `${label} — ${shift.note}` : label}
                            className="rounded-md bg-primary/10 px-2 py-1 text-left text-xs text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {content}
                          </button>
                        ) : (
                          <div key={shift.id} title={shift.note ? `${label} — ${shift.note}` : label} className="rounded-md bg-primary/10 px-2 py-1 text-xs text-primary">
                            {content}
                          </div>
                        );
                      })}
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => onAdd(employee.id, day)}
                          aria-label={`Add shift for ${employee.fullName} on ${dayParts(day).weekday} ${dayParts(day).short}`}
                          className="flex h-6 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                );
              })}
              <td className="px-4 py-3 text-right font-medium">{formatHours(stats.minutesByEmployee.get(employee.id) ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

