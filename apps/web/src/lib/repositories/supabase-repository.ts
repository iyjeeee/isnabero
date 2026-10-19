import type { SupabaseClient } from "@supabase/supabase-js";
import { LAST_OWNER_MESSAGE, normalizeBusinessName, normalizeReceiptDetails, summarizeLines } from "./repository";
import type {
  BusinessView,
  SaveBusinessSetupInput,
  ReceiptDetailsInput,
  CoreRepository,
  CreateEmployeeInput,
  UpdateEmployeeInput,
  DashboardStats,
  EmployeeView,
  PaymentRecordView,
  ListPaymentRecordsOptions,
  AuditLogEntry,
  ListAuditLogOptions,
  Membership,
} from "./repository";
import { fetchAllRows } from "./paginate";
import { MODULE_REGISTRY, normalizeModules, type ModuleKey } from "@/lib/module-registry";

const BUSINESS_COLUMNS = "id, name, slug, setup_completed_at, address, tin, contact_number, receipt_footer";

type PaymentDetail = { summary: string | null; receiptNumber: number | null; cashierName: string | null; customerName: string | null };

// fetchPaymentDetails: what each payment was for (POS order lines / booking), in chunks so the id list never blows the URL limit.
// Best-effort: if the lookup fails the payments still list, just without the extra detail.
async function fetchPaymentDetails(supabase: SupabaseClient, paymentIds: string[]): Promise<Map<string, PaymentDetail>> {
  const details = new Map<string, PaymentDetail>();
  try {
    for (let start = 0; start < paymentIds.length; start += 100) {
      const ids = paymentIds.slice(start, start + 100);
      const [orders, bookings] = await Promise.all([
        supabase.from("pos_orders").select("payment_record_id, receipt_number, cashier:employees(full_name), items:pos_order_items(quantity, offering:offerings(name))").in("payment_record_id", ids),
        supabase.from("bookings").select("payment_record_id, customer_name, offering:offerings(name)").in("payment_record_id", ids),
      ]);
      if (orders.error) throw orders.error;
      if (bookings.error) throw bookings.error;
      for (const order of (orders.data ?? []) as any[]) {
        details.set(order.payment_record_id, {
          summary: summarizeLines((order.items ?? []).map((item: any) => ({ name: item.offering?.name ?? "Item", quantity: item.quantity }))),
          receiptNumber: order.receipt_number,
          cashierName: order.cashier?.full_name ?? null,
          customerName: null,
        });
      }
      for (const booking of (bookings.data ?? []) as any[]) {
        details.set(booking.payment_record_id, { summary: booking.offering?.name ?? null, receiptNumber: null, cashierName: null, customerName: booking.customer_name });
      }
    }
  } catch (error) {
    console.warn("Payment details unavailable", error);
  }
  return details;
}

export function createSupabaseCoreRepository(supabase: SupabaseClient): CoreRepository {
  // assertNotLastOwner: throws if `employeeId` is currently the business's only owner
  async function assertNotLastOwner(businessId: string, employeeId: string) {
    const { data, error } = await supabase.from("employees").select("id").eq("business_id", businessId).eq("role", "owner");
    if (error) throw error;
    if ((data ?? []).length === 1 && data?.[0]?.id === employeeId) throw new Error(LAST_OWNER_MESSAGE);
  }

  const mapBusinessRow = (row: any): BusinessView => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    setupCompletedAt: row.setup_completed_at ? new Date(row.setup_completed_at) : null,
    address: row.address ?? null,
    tin: row.tin ?? null,
    contactNumber: row.contact_number ?? null,
    receiptFooter: row.receipt_footer ?? null,
  });

  return {
    async getBusiness(businessId): Promise<BusinessView> {
      const { data, error } = await supabase.from("businesses").select(BUSINESS_COLUMNS).eq("id", businessId).single();
      if (error) throw error;
      return mapBusinessRow(data);
    },

    async saveBusinessSetup(businessId, input: SaveBusinessSetupInput): Promise<BusinessView> {
      const name = normalizeBusinessName(input.name);
      const enabled = new Set(normalizeModules(input.enabledModules));

      const { data: current, error: currentError } = await supabase.from("businesses").select("setup_completed_at").eq("id", businessId).single();
      if (currentError) throw currentError;

      // Modules first, the business row (which stamps completion) last: a partial failure leaves setup unfinished, so the wizard reappears
      const { error: modulesError } = await supabase
        .from("business_modules")
        .upsert(
          MODULE_REGISTRY.map((definition) => ({ business_id: businessId, module_key: definition.key, enabled: enabled.has(definition.key) })),
          { onConflict: "business_id,module_key" },
        );
      if (modulesError) throw modulesError;

      const { data, error } = await supabase
        .from("businesses")
        .update({ name, setup_completed_at: current?.setup_completed_at ?? new Date().toISOString() })
        .eq("id", businessId)
        .select(BUSINESS_COLUMNS)
        .single();
      if (error) throw error;
      return mapBusinessRow(data);
    },

    // The audit trigger (migration 0007) logs "Receipt details updated" — don't log here
    async saveReceiptDetails(businessId, input: ReceiptDetailsInput): Promise<BusinessView> {
      const next = normalizeReceiptDetails(input);
      const { data, error } = await supabase
        .from("businesses")
        .update({ address: next.address, tin: next.tin, contact_number: next.contactNumber, receipt_footer: next.receiptFooter })
        .eq("id", businessId)
        .select(BUSINESS_COLUMNS)
        .single();
      if (error) throw error;
      return mapBusinessRow(data);
    },

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
      const rows = await fetchAllRows<any>((from, to) => {
        let query = supabase.from("payment_records").select("*").eq("business_id", businessId);
        if (!options?.includeVoided) query = query.is("voided_at", null);
        return query.order("created_at", { ascending: false }).order("id").range(from, to);
      });
      const details = await fetchPaymentDetails(supabase, rows.map((row: any) => row.id));
      return rows.map((row: any) => ({
        id: row.id,
        sourceModule: row.source_module,
        method: row.method,
        referenceCode: row.reference_code,
        amount: Number(row.amount),
        createdAt: new Date(row.created_at),
        voidedAt: row.voided_at ? new Date(row.voided_at) : null,
        summary: details.get(row.id)?.summary ?? null,
        receiptNumber: details.get(row.id)?.receiptNumber ?? null,
        cashierName: details.get(row.id)?.cashierName ?? null,
        customerName: details.get(row.id)?.customerName ?? null,
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
      if (input.role !== "owner") await assertNotLastOwner(businessId, employeeId);
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
      await assertNotLastOwner(businessId, employeeId);
      const { error } = await supabase.from("employees").delete().eq("id", employeeId).eq("business_id", businessId);
      if (error) throw error;
    },

    async listAuditLog(businessId, options?: ListAuditLogOptions): Promise<AuditLogEntry[]> {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(options?.limit ?? 500);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        actorId: row.actor_id,
        actorName: row.actor_name,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        summary: row.summary,
        createdAt: new Date(row.created_at),
      }));
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

    async getMembership(userId): Promise<Membership | null> {
      // RLS already limits employees to the user's own businesses; oldest row first so the pick is stable
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, role, created_at, business:businesses(id, name)")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      const business = data?.business as unknown as { id: string; name: string } | null | undefined;
      if (!data || !business) return null;
      return { business: { id: business.id, name: business.name }, employee: { id: data.id, fullName: data.full_name, role: data.role, createdAt: new Date(data.created_at) } };
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
