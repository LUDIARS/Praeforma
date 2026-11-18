// SQLite (個人用の旧保存先) から Postgres (正本) へ行を写す計画 (spec/feature/postgres-primary.md)。
// DB に触らない純関数。scripts/sqlite-to-postgres.ts が使う。

/** 写さない表。migration の記録は Postgres 側の runner が持つ。 */
const SKIP_TABLES = new Set(['schema_migrations', 'sqlite_sequence']);

/**
 * migration の SQL を番号順に並べたものから、表が作られる順を取り出す。
 * Postgres は参照先の表が先に無いと FOREIGN KEY を張れないので、この順で入れれば参照の順を守れる。
 */
export function tableCreationOrder(migrationSqlInOrder: readonly string[]): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  const pattern = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?public"?\.)?"?([a-z_][a-z0-9_]*)"?/gi;
  for (const sql of migrationSqlInOrder) {
    for (const match of sql.matchAll(pattern)) {
      const name = match[1]!.toLowerCase();
      if (!seen.has(name)) { seen.add(name); order.push(name); }
    }
  }
  return order;
}

export interface CopyPlan {
  /** 写す順の表 (両方にある表だけ)。 */
  tables: string[];
  /** SQLite にだけある表。1 つでもあれば書き込みを止める (黙って捨てない)。 */
  sqliteOnly: string[];
}

export function planCopy(sqliteTables: readonly string[], pgOrder: readonly string[]): CopyPlan {
  const source = new Set(sqliteTables.map((t) => t.toLowerCase()).filter((t) => !SKIP_TABLES.has(t)));
  const target = new Set(pgOrder);
  return {
    tables: pgOrder.filter((t) => source.has(t) && !SKIP_TABLES.has(t)),
    sqliteOnly: [...source].filter((t) => !target.has(t)).sort(),
  };
}

/** 両方にある列だけを写す。SQLite にだけある列は報告する。 */
export function commonColumns(sqliteColumns: readonly string[], pgColumns: readonly string[]): { columns: string[]; sqliteOnly: string[] } {
  const target = new Set(pgColumns);
  return {
    columns: sqliteColumns.filter((c) => target.has(c)),
    sqliteOnly: sqliteColumns.filter((c) => !target.has(c)),
  };
}

/**
 * SQLite の値を Postgres の列型に合わせる。
 * - timestamp: SQLite は ms 整数 (drizzle timestamp_ms) か ISO 文字列で持つ
 * - boolean: SQLite は 0/1
 * - jsonb/json: SQLite は JSON 文字列。そのまま渡せば Postgres が解釈する
 * - 配列 (udt が _ で始まる): SQLite は JSON 文字列
 */
export function convertValue(dataType: string, udtName: string, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  const type = dataType.toLowerCase();
  if (type.startsWith('timestamp') || type === 'date') {
    if (typeof value === 'number') return new Date(value);
    if (typeof value === 'string' && /^\d+$/.test(value)) return new Date(Number(value));
    return value;
  }
  if (type === 'boolean') {
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true';
    return value;
  }
  if (type === 'array' || udtName.startsWith('_')) {
    if (typeof value === 'string') {
      const parsed: unknown = JSON.parse(value);
      if (!Array.isArray(parsed)) throw new Error(`expected JSON array for ${udtName}`);
      return parsed;
    }
    return value;
  }
  if (type === 'jsonb' || type === 'json') {
    return typeof value === 'string' ? value : JSON.stringify(value);
  }
  if (typeof value === 'bigint') return value.toString();
  return value;
}

/** `nextval('seq'::regclass)` から sequence 名を取り出す。 */
export function sequenceOf(columnDefault: string | null): string | null {
  const match = columnDefault?.match(/^nextval\('([^']+)'(?:::regclass)?\)$/);
  return match ? match[1]! : null;
}

/** 安全な識別子だけを引用付きで返す (表名・列名は DB のカタログ由来だが念のため)。 */
export function quoteIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) throw new Error(`unsafe identifier: ${name}`);
  return `"${name}"`;
}
