import { useMemo, useState } from "react";
import { ShoppingCart, X, Search, Box, Layers, PlusCircle, Receipt } from "lucide-react";
import { useOfferings } from "@isnabero/module-catalog";
import { useCartStore, useCheckout } from "@isnabero/module-pos";
import { useStockLevels, type StockLevel } from "@isnabero/module-inventory";
import { Card, CardContent, PageHeader, EmptyState, Skeleton, Input, FilterBar, QuantityStepper, Badge, cn } from "@isnabero/ui";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useT } from "@/i18n";
import { useBusinessStore } from "@/stores/business-store";
import { useAuth } from "@/providers/AuthProvider";
import { CheckoutModal } from "@/components/pos/CheckoutModal";
import { ReceiptDialog } from "@/components/receipt/ReceiptDialog";

// TYPE_ICON/TYPE_TILE_TINT: same type-accent mapping as Catalog, so an item keeps the same visual
// identity whether you're editing it there or tapping it here to ring up a sale.
const TYPE_ICON = { item: Box, bundle: Layers, addon: PlusCircle } as const;
const TYPE_TILE_TINT = {
  item: "bg-primary/10 text-primary",
  bundle: "bg-info/10 text-info",
  addon: "bg-secondary text-secondary-foreground",
} as const;

export default function PosPage() {
  const { t } = useT();
  const businessId = useBusinessStore((state) => state.businessId) ?? "";
  const { data: offerings = [], isLoading } = useOfferings(supabase, businessId);
  const { lines, addOffering, updateQuantity, removeLine, clear, total } = useCartStore();
  const { employee } = useAuth(); // cashier recorded on the order; null until the employee row resolves
  const checkout = useCheckout(supabase);
  const { data: stockLevels = [] } = useStockLevels(supabase, businessId);
  const stockByOffering = useMemo(() => new Map<string, StockLevel>(stockLevels.map((level) => [level.offeringId, level])), [stockLevels]);
  const [search, setSearch] = useState("");
  const [receiptOrderId, setReceiptOrderId] = useState<string | null>(null); // the receipt shown after a sale

  const handleCheckout = (method: "cash" | "gcash" | "bank_transfer" | "other", referenceCode?: string) => {
    checkout.mutate(
      { businessId, employeeId: employee?.id ?? null, lines, method, referenceCode },
      {
        onSuccess: (result) => {
          toast.success(t("pos.page.saleCompleted", { total: total().toFixed(2) }));
          clear();
          setReceiptOrderId(result.orderId);
        },
      },
    );
  };

  // addToCart: a tracked item can't be added beyond what's in stock (the repository enforces it again at checkout)
  const addToCart = (offering: (typeof offerings)[number]) => {
    const stock = stockByOffering.get(offering.id);
    const inCart = lines.find((line) => line.offering.id === offering.id)?.quantity ?? 0;
    if (stock && inCart >= stock.quantity) {
      toast.error(stock.quantity <= 0 ? t("pos.page.outOfStockToast", { name: offering.name }) : t("pos.page.onlyLeftToast", { count: stock.quantity, name: offering.name }));
      return;
    }
    addOffering(offering);
  };

  const availableOfferings = useMemo(
    () => offerings.filter((offering) => offering.isAvailable && offering.name.toLowerCase().includes(search.toLowerCase())),
    [offerings, search],
  );

  return (
    <div className="space-y-6">
      <PageHeader icon={ShoppingCart} title={t("pos.page.title")} description={t("pos.page.description")} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {offerings.length > 0 && (
            <FilterBar className="sm:justify-start">
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder={t("pos.page.searchPlaceholder")} value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
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
            <EmptyState icon={ShoppingCart} title={t("pos.page.nothingTitle")} description={t("pos.page.nothingDescription")} />
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {availableOfferings.map((offering) => {
              const TypeIcon = TYPE_ICON[offering.type];
              const stock = stockByOffering.get(offering.id);
              const soldOut = stock?.status === "out";
              return (
                <button
                  key={offering.id}
                  onClick={() => addToCart(offering)}
                  disabled={soldOut}
                  className="group flex flex-col items-start gap-2.5 rounded-lg border bg-card p-4 text-left shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elevated active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                >
                  <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg transition-transform duration-150 group-hover:scale-105", TYPE_TILE_TINT[offering.type])}>
                    <TypeIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium leading-tight">{offering.name}</p>
                    <p className="mt-0.5 text-sm font-semibold text-primary">₱{Number(offering.price).toFixed(2)}</p>
                  </div>
                  {stock && (
                    <Badge variant={stock.status === "out" ? "destructive" : stock.status === "low" ? "warning" : "secondary"}>
                      {stock.status === "out" ? t("pos.page.outOfStock") : t("pos.page.left", { count: stock.quantity })}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <Card className="sticky top-6 h-fit">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                <p className="font-semibold">{t("pos.cart.title")}</p>
              </div>
              {lines.length > 0 && <Badge variant="secondary">{t("pos.cart.items", { count: lines.length })}</Badge>}
            </div>

            {lines.length === 0 && (
              <EmptyState icon={Receipt} title={t("pos.cart.emptyTitle")} description={t("pos.cart.emptyDescription")} className="border-0 py-8" />
            )}

            {lines.length > 0 && (
              <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
                {lines.map((line) => (
                  <div key={line.offering.id} className="flex items-center justify-between gap-2 rounded-md py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{line.offering.name}</p>
                      <p className="text-xs text-muted-foreground">{t("pos.cart.each", { price: Number(line.offering.price).toFixed(2) })}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {/* min=1: clearing the box to retype must not drop the line — removal is the X button */}
                      <QuantityStepper min={1} max={stockByOffering.get(line.offering.id)?.quantity ?? 999} value={line.quantity} onChange={(next) => updateQuantity(line.offering.id, next)} />
                      <button
                        onClick={() => removeLine(line.offering.id)}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label={t("pos.cart.remove", { name: line.offering.name })}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-1 border-t pt-3">
              <div className="flex items-center justify-between text-lg font-bold">
                <span>{t("pos.cart.total")}</span>
                <span className="font-display text-primary">₱{total().toFixed(2)}</span>
              </div>
            </div>
            <CheckoutModal lines={lines} total={total()} isPending={checkout.isPending} onConfirm={handleCheckout} />
          </CardContent>
        </Card>
      </div>
      <ReceiptDialog businessId={businessId} reference={receiptOrderId ? { orderId: receiptOrderId } : null} onClose={() => setReceiptOrderId(null)} />
    </div>
  );
}
