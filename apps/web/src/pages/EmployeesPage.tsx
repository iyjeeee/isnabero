import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, ShieldCheck, UserCog, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useBusinessStore } from "@/stores/business-store";
import { getCoreRepository } from "@/lib/repositories/get-repository";
import { usePermission } from "@/hooks/use-permission";
import { useAuth } from "@/providers/AuthProvider";
import { usePagination } from "@/hooks/use-pagination";
import { useFormat, useLabels, useT } from "@/i18n";
import { Card, CardContent, Badge, PageHeader, EmptyState, Skeleton, StatCard, FilterBar, Input, Pagination, cn } from "@isnabero/ui";
import { ExportButton } from "@/components/ExportButton";
import { employeeRows } from "@/lib/export-rows";
import { AddEmployeeModal } from "@/components/employees/AddEmployeeModal";
import { EditEmployeeModal } from "@/components/employees/EditEmployeeModal";
import { DeleteEmployeeButton } from "@/components/employees/DeleteEmployeeButton";
import { EmployeeDetailDialog } from "@/components/details/EmployeeDetailDialog";
import { OPEN_CLASS, openProps } from "@/components/details/open-props";

const ROLE_BADGE_VARIANT = { owner: "default", admin: "info", staff: "secondary" } as const;
const ROLE_TABS = ["all", "owner", "admin", "staff"] as const;
const PAGE_SIZE = 10;

export default function EmployeesPage() {
  const { t } = useT();
  const format = useFormat();
  const labels = useLabels();
  const businessId = useBusinessStore((state) => state.businessId) ?? "";
  const repository = getCoreRepository(supabase);
  // Managing staff (adding/editing/removing) is restricted to owner/admin — staff can view the list
  // but shouldn't be able to change who has access or what role they have.
  const canManage = usePermission("employees.manage");
  const { employee: currentEmployee } = useAuth(); // used to hide "delete" on your own row

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees", businessId],
    queryFn: () => repository.listEmployees(businessId),
    enabled: Boolean(businessId),
  });

  const [detailId, setDetailId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<(typeof ROLE_TABS)[number]>("all");

  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      const matchesRole = roleFilter === "all" || employee.role === roleFilter;
      const matchesSearch = employee.fullName.toLowerCase().includes(search.toLowerCase());
      return matchesRole && matchesSearch;
    });
  }, [employees, search, roleFilter]);

  const { page, setPage, totalPages, pageItems, totalItems } = usePagination(filteredEmployees, PAGE_SIZE);

  const ownerCount = employees.filter((employee) => employee.role === "owner").length;
  const staffCount = employees.filter((employee) => employee.role === "staff" || employee.role === "admin").length;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Users}
        title={t("nav.employees")}
        description={t("employees.description")}
        action={
          canManage ? (
            <div className="flex items-center gap-2">
              <ExportButton title="Employees" filenamePrefix="employees" disabled={filteredEmployees.length === 0} buildRows={() => employeeRows(filteredEmployees)} />
              <AddEmployeeModal businessId={businessId} />
            </div>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t("employees.stats.total")} value={employees.length} icon={Users} accent="default" isLoading={isLoading} />
        <StatCard label={t("employees.stats.owners")} value={ownerCount} icon={ShieldCheck} accent="info" isLoading={isLoading} />
        <StatCard label={t("employees.stats.staffAdmins")} value={staffCount} icon={UserCog} accent="success" isLoading={isLoading} />
      </div>

      {employees.length > 0 && (
        <FilterBar>
          <div className="flex gap-1 rounded-lg border bg-background p-1">
            {ROLE_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setRoleFilter(tab)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  roleFilter === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
                )}
              >
                {tab === "all" ? t("common.all") : labels.role(tab)}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={t("employees.searchPlaceholder")} value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
          </div>
        </FilterBar>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading && (
            <div className="space-y-3 p-5">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )}

          {!isLoading && employees.length === 0 && (
            <EmptyState
              icon={Users}
              title={t("employees.empty.title")}
              description={t("employees.empty.description")}
              className="border-0"
            />
          )}

          {!isLoading && employees.length > 0 && filteredEmployees.length === 0 && (
            <EmptyState icon={Search} title={t("employees.noMatches.title")} description={t("employees.noMatches.description")} className="border-0" />
          )}

          {!isLoading && pageItems.length > 0 && (
            <table className="stack-table w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{t("common.name")}</th>
                  <th className="px-4 py-3">{t("employees.table.role")}</th>
                  <th className="px-4 py-3">{t("employees.table.added")}</th>
                  {canManage && <th className="px-4 py-3 text-right">{t("common.actions")}</th>}
                </tr>
              </thead>
              <tbody>
                {pageItems.map((employee) => (
                  <tr key={employee.id} {...openProps(() => setDetailId(employee.id))} title={t("details.open", { name: employee.fullName })} className={cn("border-b transition-colors last:border-0 hover:bg-accent/50", OPEN_CLASS)}>
                    <td data-label={t("common.name")} className="px-4 py-3 font-medium">
                      {employee.fullName}
                      {employee.id === currentEmployee?.id && <Badge variant="outline" className="ml-2">{t("details.you")}</Badge>}
                    </td>
                    <td data-label={t("employees.table.role")} className="px-4 py-3">
                      <Badge variant={ROLE_BADGE_VARIANT[employee.role as keyof typeof ROLE_BADGE_VARIANT] ?? "secondary"} className="capitalize">
                        {labels.role(employee.role)}
                      </Badge>
                    </td>
                    <td data-label={t("employees.table.added")} className="px-4 py-3">{format.date(employee.createdAt)}</td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <EditEmployeeModal businessId={businessId} employee={employee} />
                          {employee.id !== currentEmployee?.id && (
                            <DeleteEmployeeButton businessId={businessId} employeeId={employee.id} employeeName={employee.fullName} />
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!isLoading && pageItems.length > 0 && (
            <div className="px-4">
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={totalItems} pageSize={PAGE_SIZE} />
            </div>
          )}
        </CardContent>
      </Card>
      <EmployeeDetailDialog employee={employees.find((employee) => employee.id === detailId) ?? null} isYou={detailId === currentEmployee?.id} onClose={() => setDetailId(null)} />
    </div>
  );
}
