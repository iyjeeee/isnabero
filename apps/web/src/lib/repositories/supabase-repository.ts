import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CoreRepository,
  CreateEmployeeInput,
  UpdateEmployeeInput,
  DashboardStats,
  EmployeeView,
  PaymentRecordView,
  ListPaymentRecordsOptions,
} from "./repository";
import type { ModuleKey } from "@/lib/module-registry";

export function createSupabaseCoreRepository(supabase: SupabaseClient): CoreRepository {
  return {
    async listEnabledModules(businessId): Promise<ModuleKey[]> {
      const { data, error } = await supabase
        .from("business_modules")
        .select("module_key")
        .eq("business_id", businessId)
        .eq("enabled", true);
      if (error) throw error;
      return (data ?? []).map((row) => row.module_key as ModuleKey);
    },

    async listPaymentRecords(businessId, options?: ListPaymentRecordsOptions): Promise<PaymentRecordView[]> {
      let query = supabase.from("payment_records").select("*").eq("business_id", businessId);
      if (!options?.includeVoided) query = query.is("voided_at", null);
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        id: row.id,
        sourceModule: row.source_module,
        method: row.method,
        referenceCode: row.reference_code,
        amount: Number(row.amount),
        createdAt: new Date(row.created_at),
        voidedAt: row.voided_at ? new Date(row.voided_at) : null,
      }));
    },

    async voidPaymentRecord(businessId, recordId): Promise<void> {
      const { error } = await supabase
        .from("payment_records")
        .update({ voided_at: new Date().toISOString() })
        .eq("id", recordId)
        .eq("business_id", businessId);
      if (error) throw error;
    },

    async listEmployees(businessId): Promise<EmployeeView[]> {
      const { data, error } = await supabase.from("employees").select("*").eq("business_id", businessId);
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        id: row.id,
        fullName: row.full_name,
        role: row.role,
        createdAt: new Date(row.created_at),
      }));
    },

    async createEmployee(businessId, input: CreateEmployeeInput): Promise<EmployeeView> {
      // NOTE: user_id is a placeholder random UUID until a real invite/auth flow exists — this employee
      // row won't be linkable to an actual auth.users login yet. Prefer the invite-employee Edge
      // Function (supabase/functions/invite-employee) for real deployments, which creates a genuine
      // auth.users row via the admin API instead of this placeholder.
      const { data, error } = await supabase
        .from("employees")
        .insert({ business_id: businessId, user_id: crypto.randomUUID(), full_name: input.fullName, role: input.role })
        .select()
        .single();
      if (error) throw error;
      return { id: data.id, fullName: data.full_name, role: data.role, createdAt: new Date(data.created_at) };
    },

    async updateEmployee(businessId, employeeId, input: UpdateEmployeeInput): Promise<EmployeeView> {
      const { data, error } = await supabase
        .from("employees")
        .update({ full_name: input.fullName, role: input.role })
        .eq("id", employeeId)
        .eq("business_id", businessId)
        .select()
        .single();
      if (error) throw error;
      return { id: data.id, fullName: data.full_name, role: data.role, createdAt: new Date(data.created_at) };
    },

    async deleteEmployee(businessId, employeeId): Promise<void> {
      const { error } = await supabase.from("employees").delete().eq("id", employeeId).eq("business_id", businessId);
      if (error) throw error;
    },

    async getCurrentEmployee(businessId, userId): Promise<EmployeeView | null> {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("business_id", businessId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { id: data.id, fullName: data.full_name, role: data.role, createdAt: new Date(data.created_at) };
    },

    async getDashboardStats(businessId): Promise<DashboardStats> {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const now = new Date();

      const [salesResult, bookingsResult, employeesResult] = await Promise.all([
        supabase
          .from("payment_records")
          .select("amount")
          .eq("business_id", businessId)
          .is("voided_at", null)
          .gte("created_at", startOfDay.toISOString()),
        supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId)
          .gte("start_time", now.toISOString())
          .in("status", ["pending", "confirmed"]),
        supabase.from("employees").select("id", { count: "exact", head: true }).eq("business_id", businessId),
      ]);

      if (salesResult.error) throw salesResult.error;
      if (bookingsResult.error) throw bookingsResult.error;
      if (employeesResult.error) throw employeesResult.error;

      const todaySalesTotal = (salesResult.data ?? []).reduce((sum: number, record: any) => sum + Number(record.amount), 0);

      return {
        todaySalesTotal,
        upcomingBookingsCount: bookingsResult.count ?? 0,
        activeEmployeesCount: employeesResult.count ?? 0,
      };
    },
  };
}
