// JSON with Date support: query data holds real Date objects, which plain JSON would turn into strings on restore.
const TAG = "__date";

export function stringifyWithDates(value: unknown): string {
  return JSON.stringify(value, function (this: Record<string, unknown>, key: string, current: unknown) {
    const original = this[key];
    return original instanceof Date ? { [TAG]: Number.isNaN(original.getTime()) ? null : original.toISOString() } : current;
  });
}

export function parseWithDates<T = unknown>(text: string): T {
  return JSON.parse(text, (_key, value: unknown) => {
    if (value && typeof value === "object" && TAG in value) {
      const iso = (value as Record<string, string | null>)[TAG];
      return iso === null ? new Date(NaN) : new Date(iso as string);
    }
    return value;
  }) as T;
}
