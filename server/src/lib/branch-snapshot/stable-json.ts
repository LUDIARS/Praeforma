/** Deterministic JSON for files kept in git: the same data always gives the same bytes. */

// The data branch can reach a code host, so people are not identified in it.
const PERSONAL_FIELD = /(?:By|UserId|DisplayName)$/;

function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value === null || typeof value !== 'object') return value;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !PERSONAL_FIELD.test(key))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, item]) => [key, normalize(item)]);
  return Object.fromEntries(entries);
}

export function stableJson(value: unknown): string {
  return `${JSON.stringify(normalize(value), null, 2)}\n`;
}

/** Rows in a stable order regardless of how the database returned them. */
export function stableRowsJson(rows: readonly unknown[]): string {
  const normalized = rows.map(normalize).map((row) => ({ row, key: JSON.stringify(row) }));
  normalized.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return `${JSON.stringify(normalized.map((entry) => entry.row), null, 2)}\n`;
}
