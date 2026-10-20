import type { SupabaseClient } from "@supabase/supabase-js";
import type { CheckoutInput, CheckoutResult, PosRepository } from "./repository";
import type { Receipt, ReceiptRef } from "./receipt";

// CHECK_VIOLATION: raised by checkout_sale (migration 0006) when a tracked item doesn't have enough stock; its message is user-facing
const CHECK_VIOLATION = "23514";

export function createSupabasePosRepository(supabase: SupabaseClient): PosRepository {
  return {
    // One database function does the whole sale (payment record, order, items, stock deduction) in a single transaction,
    // so a stock shortage can't leave a half-recorded sale. Prices are read from the offerings table, and the cashier is the
    // signed-in employee (taken from auth.uid() in the function), so neither is trusted from the client.
    async checkout({ businessId, lines, method, referenceCode, clientId, soldAt }: CheckoutInput): Promise<CheckoutResult> {
      const { data, error } = await supabase.rpc("checkout_sale", {
        p_business: businessId,
        p_method: method,
        p_reference: referenceCode ?? null,
        p_lines: lines.map((line) => ({ offering_id: line.offering.id, quantity: line.quantity })),
        p_client_id: clientId ?? null,
        p_sold_at: soldAt ? soldAt.toISOString() : null,
      });
      if (error) throw error.code === CHECK_VIOLATION ? new Error(error.message) : error;
      const result = data as { order_id: string; total: number; receipt_number: number; duplicate?: boolean };
      return { orderId: result.order_id, total: Number(result.total), receiptNumber: result.receipt_number, duplicate: result.duplicate === true };
    },

    async getReceipt(businessId: string, ref: ReceiptRef): Promise<Receipt | null> {
      const query = supabase
        .from("pos_orders")
        .select(
          "id, receipt_number, total, status, created_at, cashier:employees(full_name), payment:payment_records(method, reference_code, voided_at), items:pos_order_items(quantity, unit_price, offering:offerings(name)), business:businesses(name, address, tin, contact_number, receipt_footer)",
        )
        .eq("business_id", businessId);
      const { data, error } = await ("orderId" in ref ? query.eq("id", ref.orderId) : query.eq("payment_record_id", ref.paymentRecordId)).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as any;
      return {
        orderId: row.id,
        receiptNumber: row.receipt_number,
        issuedAt: new Date(row.created_at),
        business: { name: row.business.name, address: row.business.address, tin: row.business.tin, contactNumber: row.business.contact_number, footer: row.business.receipt_footer },
        cashierName: row.cashier?.full_name ?? null,
        method: row.payment?.method ?? "other",
        referenceCode: row.payment?.reference_code ?? null,
        lines: (row.items ?? []).map((item: any) => {
          const unitPrice = Number(item.unit_price);
          return { name: item.offering?.name ?? "Item", quantity: item.quantity, unitPrice, amount: unitPrice * item.quantity };
        }),
        total: Number(row.total),
        voided: row.status === "voided" || Boolean(row.payment?.voided_at),
      };
    },
  };
}
