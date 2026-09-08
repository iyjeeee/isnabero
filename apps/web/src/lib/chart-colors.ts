// Literal color values (not CSS var() references) — recharts sets SVG fill/stroke attributes directly,
// and while modern browsers do support var() in SVG presentation attributes, using literals here avoids
// any risk of that not resolving correctly. Hues are chosen to match the app's design tokens
// (index.css): maroon primary, info blue, success green, warning amber, plus a couple of extras for
// charts with more than 4 series.
export const CHART_COLORS = [
  "hsl(350, 65%, 45%)", // primary maroon
  "hsl(199, 89%, 45%)", // info blue
  "hsl(152, 60%, 40%)", // success green
  "hsl(38, 92%, 50%)", // warning amber
  "hsl(280, 55%, 55%)", // extra purple
  "hsl(199, 30%, 60%)", // muted blue-gray
];

export const METHOD_COLORS: Record<string, string> = {
  cash: CHART_COLORS[2]!,
  gcash: CHART_COLORS[1]!,
  bank_transfer: CHART_COLORS[0]!,
  other: CHART_COLORS[5]!,
};

export const STATUS_COLORS: Record<string, string> = {
  Pending: CHART_COLORS[3]!,
  Confirmed: CHART_COLORS[1]!,
  Completed: CHART_COLORS[2]!,
  Cancelled: CHART_COLORS[0]!,
};
