import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, ShieldCheck, UserCog, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useBusinessStore } from "@/stores/business-store";
import { getCoreRepository } from "@/lib/repositories/get-repository";
import { useHasRole } from "@/hooks/use-has-role";
import { usePagination } from "@/hooks/use-pagination";
import { Card, CardContent, Badge, PageHeader, EmptyState, Skeleton, StatCard, FilterBar, Input, Pagination, cn } from "@isnabero/ui";
import { AddEmployeeModal } from "@/components/employees/AddEmployeeModal";
import { EditEmployeeModal } from "@/components/employees/EditEmployeeModal";
import { DeleteEmployeeButton } from "@/components/employees/DeleteEmployeeButton";

const ROLE_BADGE_VARIANT = { owner: "default", admin: "info", staff: "secondary" } as const;
const ROLE_TABS = [
  { value: "all", label: "All" },
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "staff", label: "Staff" },
] as const;
const PAGE_SIZE = 10;

export default function EmployeesPage() {
  const businessId = useBusinessStore((state) => state.businessId) ?? "";
  const repository = getCoreRepository(supabase);
  // Managing staff (adding/editing/removing) is restricted to owner/admin — staff can view the list
  // but shouldn't be able to change who has access or what role they have.
  const canManage = useHasRole(["owner", "admin"]);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees", businessId],
    queryFn: () => repository.listEmployees(businessId),
    enabled: Boolean(businessId),
  });

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<(typeof ROLE_TABS)[number]["value"]>("all");

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
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        title="Employees"
        description="Staff accounts and roles for this business."
        action={canManage ? <AddEmployeeModal businessId={businessId} /> : undefined}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Employees" value={employees.length} icon={Users} accent="default" isLoading={isLoading} />
        <StatCard label="Owners" value={ownerCount} icon={ShieldCheck} accent="info" isLoading={isLoading} />
        <StatCard label="Staff & Admins" value={staffCount} icon={UserCog} accent="success" isLoading={isLoading} />
      </div>

      {employees.length > 0 && (
        <FilterBar>
          <div className="flex gap-1 rounded-lg border bg-background p-1">
            {ROLE_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setRoleFilter(tab.value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  roleFilter === tab.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search employees…" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
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
              title="No employees added yet"
              description="Add your team so they can be assigned to sales and bookings."
              className="border-0"
            />
          )}

          {!isLoading && employees.length > 0 && filteredEmployees.length === 0 && (
            <EmptyState icon={Search} title="No matches" description="Try a different search term or role filter." className="border-0" />
          )}

          {!isLoading && pageItems.length > 0 && (
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Added</th>
                  {canManage && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {pageItems.map((employee) => (
                  <tr key={employee.id} className="border-b transition-colors last:border-0 hover:bg-accent/50">
                    <td className="px-4 py-3 font-medium">{employee.fullName}</td>
                    <td className="px-4 py-3">
                      <Badge variant={ROLE_BADGE_VARIANT[employee.role as keyof typeof ROLE_BADGE_VARIANT] ?? "secondary"} className="capitalize">
                        {employee.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{employee.createdAt.toLocaleDateString()}</td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <EditEmployeeModal businessId={businessId} employee={employee} />
                          <DeleteEmployeeButton businessId={businessId} employeeId={employee.id} employeeName={employee.fullName} />
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
    </div>
  );
}
