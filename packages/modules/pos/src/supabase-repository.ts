import type { SupabaseClient } from "@supabase/supabase-js";
import type { CheckoutInput, CheckoutResult, PosRepository } from "./repository";

export function createSupabasePosRepository(supabase: SupabaseClient): PosRepository {
  return {
    async checkout({ businessId, employeeId, lines, method, referenceCode }: CheckoutInput): Promise<CheckoutResult> {
      const total = lines.reduce((sum, line) => sum + Number(line.offering.price) * line.quantity, 0);

      const { data: payment, error: paymentError } = await supabase
        .from("payment_records")
        .insert({ business_id: businessId, source_module: "pos", method, reference_code: referenceCode ?? null, amount: total })
        .select()
        .single();
      if (paymentError) throw paymentError;

      const { data: order, error: orderError } = await supabase
        .from("pos_orders")
        .insert({ business_id: businessId, employee_id: employeeId, status: "paid", total, payment_record_id: payment.id })
        .select()
        .single();
      if (orderError) throw orderError;

      const { error: itemsError } = await supabase.from("pos_order_items").insert(
        lines.map((line) => ({
          order_id: order.id,
          offering_id: line.offering.id,
          quantity: line.quantity,
          unit_price: line.offering.price,
        })),
      );
      if (itemsError) throw itemsError;

      return { orderId: order.id, total };
    },
  };
}
