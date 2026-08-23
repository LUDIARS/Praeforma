// migration SQL を 1 文ずつに割る (scripts/migrate.ts が使う)。 純関数。
//
// 見出しコメントの直後に書かれた文が落ちないことが肝心。 「`--` で始まる断片を捨てる」だけだと
// `-- 見出し\nCREATE TABLE …;` の CREATE TABLE ごと消える (004 で全テーブルが無視された)。
// 落ちた DDL は後続文の 42P01 / 42710 として runner の skippable に吸われるので、
// 失敗が表に出ないまま migration が「適用済み」として記録されてしまう。

/** 行頭の空行と行コメントだけを剥がす。 SQL 本体が残らなければ空文字。 */
export function stripLeadingComments(chunk: string): string {
  const lines = chunk.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!.trim();
    if (line !== '' && !line.startsWith('--')) break;
    i++;
  }
  return lines.slice(i).join('\n').trim();
}

/** 行末の `;` で分割し、 コメントだけの断片を除いた実行対象の文を返す。 */
export function splitSqlStatements(sql: string): string[] {
  return sql
    .split(/;\s*$/m)
    .map(stripLeadingComments)
    .filter((s) => s.length > 0);
}
