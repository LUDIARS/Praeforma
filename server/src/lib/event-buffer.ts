// event ringbuffer + パターン評価 (Step 12)。
//
// runtime probe が POST してくる event 列を per-run の ringbuffer に貯め、
// spec_acceptance.expression に書かれた pattern を評価する。
//
// 採用パターン (= AIFormat の運用要件から):
//
//   sequence: { "sequence": [{ "name": "spawn" }, { "name": "hit_player" }],
//               "within_ms": 5000 }
//     → 順に出現すれば pass、 within_ms を超えたら fail
//
//   count:    { "count": { "name": "hit" }, "ge": 3, "within_ms": 10000 }
//     → 10s 以内に "hit" が >= 3 回なら pass
//
//   within:   { "within_ms": 1000, "must_emit": { "name": "ready" } }
//     → 1s 以内に "ready" が来なければ fail
//
// expression は JSON 文字列で渡ってくる。 評価は probe POST タイミングではなく、
// run 終了時に 1 回まとめて行うのが基本。

export interface BufferedEvent {
  name: string;
  ts: number; // unix ms
  payload?: Record<string, unknown>;
}

interface MatchSubject {
  name?: string;
  // 将来: payload の where 条件
}

interface PatternSequence {
  sequence: MatchSubject[];
  within_ms?: number;
}
interface PatternCount {
  count: MatchSubject;
  ge?: number;
  le?: number;
  eq?: number;
  within_ms?: number;
}
interface PatternWithin {
  within_ms: number;
  must_emit: MatchSubject;
}

export type Pattern = PatternSequence | PatternCount | PatternWithin;

export interface EvalResult {
  status: 'pass' | 'fail' | 'skip' | 'error';
  observed?: Record<string, unknown>;
  errorMessage?: string;
}

function matches(ev: BufferedEvent, subject: MatchSubject): boolean {
  if (subject.name && ev.name !== subject.name) return false;
  return true;
}

export function evalPattern(events: BufferedEvent[], expressionJson: string): EvalResult {
  let pattern: Pattern;
  try {
    pattern = JSON.parse(expressionJson) as Pattern;
  } catch (e) {
    return { status: 'error', errorMessage: `bad_expression: ${(e as Error).message}` };
  }

  if ('sequence' in pattern) return evalSequence(events, pattern);
  if ('count' in pattern) return evalCount(events, pattern);
  if ('must_emit' in pattern) return evalWithin(events, pattern);
  return { status: 'error', errorMessage: 'unknown_pattern_kind' };
}

function evalSequence(events: BufferedEvent[], p: PatternSequence): EvalResult {
  let cursor = 0;
  let firstTs: number | null = null;
  for (const ev of events) {
    const stage = p.sequence[cursor];
    if (!stage) break;
    if (matches(ev, stage)) {
      if (cursor === 0) firstTs = ev.ts;
      cursor++;
      if (cursor === p.sequence.length) {
        const last = ev.ts;
        if (p.within_ms !== undefined && firstTs !== null && last - firstTs > p.within_ms) {
          return {
            status: 'fail',
            observed: { matched: true, span_ms: last - firstTs, within_ms: p.within_ms },
          };
        }
        return { status: 'pass', observed: { span_ms: last - (firstTs ?? last) } };
      }
    }
  }
  return { status: 'fail', observed: { matched_up_to: cursor } };
}

function evalCount(events: BufferedEvent[], p: PatternCount): EvalResult {
  const filtered = p.within_ms !== undefined
    ? (() => {
        if (events.length === 0) return [];
        const start = events[0]!.ts;
        return events.filter((e) => e.ts - start <= p.within_ms!);
      })()
    : events;
  const matched = filtered.filter((e) => matches(e, p.count)).length;
  const obs = { matched, within_ms: p.within_ms };
  if (p.eq !== undefined) return { status: matched === p.eq ? 'pass' : 'fail', observed: obs };
  if (p.ge !== undefined && matched < p.ge) return { status: 'fail', observed: obs };
  if (p.le !== undefined && matched > p.le) return { status: 'fail', observed: obs };
  return { status: 'pass', observed: obs };
}

function evalWithin(events: BufferedEvent[], p: PatternWithin): EvalResult {
  if (events.length === 0) return { status: 'fail', observed: { reason: 'no_events' } };
  const start = events[0]!.ts;
  const hit = events.find((e) => matches(e, p.must_emit) && e.ts - start <= p.within_ms);
  if (hit) return { status: 'pass', observed: { ts: hit.ts - start } };
  return { status: 'fail', observed: { within_ms: p.within_ms, last_ts: events[events.length - 1]?.ts ?? null } };
}

// ── in-memory per-run buffer (= v1 は process-local、 multi-process は v2+) ──

const buffers = new Map<string, BufferedEvent[]>();
const MAX_PER_RUN = 5000;

export function appendEvent(runId: string, ev: BufferedEvent): void {
  let buf = buffers.get(runId);
  if (!buf) { buf = []; buffers.set(runId, buf); }
  buf.push(ev);
  if (buf.length > MAX_PER_RUN) buf.splice(0, buf.length - MAX_PER_RUN);
}

export function getEvents(runId: string): BufferedEvent[] {
  return buffers.get(runId) ?? [];
}

export function clearEvents(runId: string): void {
  buffers.delete(runId);
}
