// One place for how pesos are shown in the UI: ₱1,234.50 (grouping/decimals are fixed, whatever the UI language)
const AMOUNT = new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatAmount = (amount: number | string): string => AMOUNT.format(Number(amount));
export const formatPeso = (amount: number | string): string => `₱${formatAmount(amount)}`;
