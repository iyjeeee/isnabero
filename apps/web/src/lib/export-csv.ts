// escapeCell: neutralizes spreadsheet formula injection (text starting with = + - @ or a control char gets a
// leading apostrophe, so Excel/Sheets show it as text instead of running it — reference codes are free text
// typed by staff) and quotes values containing commas/quotes/newlines per CSV convention. Numbers are untouched.
function escapeCell(value: string | number): string {
  let str = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

// buildCsv: pure CSV string builder (headers come from the first row's keys) — split out so it's unit-testable
export function buildCsv(rows: Record<string, string | number>[]): string {
  const firstRow = rows[0];
  if (!firstRow) return "";
  const headers = Object.keys(firstRow);
  const lines = [headers.join(","), ...rows.map((row) => headers.map((header) => escapeCell(row[header] ?? "")).join(","))];
  return lines.join("\n");
}

// exportToCsv: builds a CSV from an array of objects and triggers a browser download. Dependency-free —
// small enough not to warrant a library.
export function exportToCsv(filename: string, rows: Record<string, string | number>[]) {
  if (rows.length === 0) return;

  const blob = new Blob([buildCsv(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
