import { useMemo, useState } from "react";
import { ShoppingCart, X, Search } from "lucide-react";
import { useOfferings } from "@isnabero/module-catalog";
import { useCartStore, useCheckout } from "@isnabero/module-pos";
import { Card, CardContent, PageHeader, EmptyState, Skeleton, Input, FilterBar } from "@isnabero/ui";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useBusinessStore } from "@/stores/business-store";
import { CheckoutModal } from "@/components/pos/CheckoutModal";

export default function PosPage() {
  const businessId = useBusinessStore((state) => state.businessId) ?? "";
  const { data: offerings = [], isLoading } = useOfferings(supabase, businessId);
  const { lines, addOffering, updateQuantity, removeLine, clear, total } = useCartStore();
  const checkout = useCheckout(supabase);
  const [search, setSearch] = useState("");

  const handleCheckout = (method: "cash" | "gcash" | "bank_transfer" | "other", referenceCode?: string) => {
    checkout.mutate(
      { businessId, employeeId: null, lines, method, referenceCode },
      {
        onSuccess: () => {
          toast.success(`Sale completed — ₱${total().toFixed(2)}`);
          clear();
        },
      },
    );
  };

  const availableOfferings = useMemo(
    () => offerings.filter((offering) => offering.isAvailable && offering.name.toLowerCase().includes(search.toLowerCase())),
    [offerings, search],
  );

  return (
    <div className="space-y-6">
      <PageHeader icon={ShoppingCart} title="POS / Cashier" description="Tap an item to add it to the current sale." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {offerings.length > 0 && (
            <FilterBar className="sm:justify-start">
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search items…" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
              </div>
            </FilterBar>
          )}

          {isLoading && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          )}

          {!isLoading && availableOfferings.length === 0 && (
            <EmptyState icon={ShoppingCart} title="Nothing available to sell" description="Add offerings in Catalog, or mark existing ones available." />
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {availableOfferings.map((offering) => (
              <button
                key={offering.id}
                onClick={() => addOffering(offering)}
                className="rounded-lg border bg-card p-4 text-left shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elevated active:scale-[0.98]"
              >
                <p className="font-medium">{offering.name}</p>
                <p className="text-sm text-muted-foreground">₱{Number(offering.price).toFixed(2)}</p>
              </button>
            ))}
          </div>
        </div>

        <Card className="h-fit">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <p className="font-semibold">Current Sale</p>
            </div>

            {lines.length === 0 && <p className="text-sm text-muted-foreground">Cart is empty — tap an item to add it.</p>}

            {lines.map((line) => (
              <div key={line.offering.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate">{line.offering.name}</p>
                  <p className="text-muted-foreground">₱{Number(line.offering.price).toFixed(2)} each</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    value={line.quantity}
                    onChange={(event) => updateQuantity(line.offering.id, Number(event.target.value))}
                    className="h-9 w-14 px-2 text-center"
                  />
                  <button
                    onClick={() => removeLine(line.offering.id)}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Remove ${line.offering.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}

            <div className="border-t pt-3">
              <div className="flex items-center justify-between font-semibold">
                <span>Total</span>
                <span>₱{total().toFixed(2)}</span>
              </div>
            </div>
            <CheckoutModal lines={lines} total={total()} isPending={checkout.isPending} onConfirm={handleCheckout} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
