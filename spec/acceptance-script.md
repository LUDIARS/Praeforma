# acceptance-script — runtime probe の event 形式と pattern DSL

## ステータス

**v1 (Step 12 で実装)**。 event ringbuffer + 3 種類の pattern matcher が
`server/src/lib/event-buffer.ts` に存在する。 「入力シーケンスを再現可能に書く DSL」
(= 旧版で想定していた W キー 1 秒 等の input script) は v0.3 で別 spec として
切り出す予定 (= 評価用 pattern とは別物)。

## 動機

「W を 1 秒押すと プレイヤーが 5m 移動する」 のような動的挙動を再現可能に
検査する。 REST 一発で検証できない要件 (= 時間軸 + sequence) を、 ringbuffer に
event を貯めて pattern で評価する。

## event 形式

probe (= Web 側 acceptance runner / Unity Runtime) が backend に POST:

```
POST /api/projects/:pid/acceptance/runs/:rid/events
{
  "events": [
    { "name": "player_spawn",      "ts": 1726490400000, "payload": { "pos": [0,0,0] } },
    { "name": "input_w_pressed",   "ts": 1726490400500 },
    { "name": "player_pos_change", "ts": 1726490400566, "payload": { "delta": [0,0,0.1] } },
    { "name": "input_w_released",  "ts": 1726490401500 },
    { "name": "player_pos_change", "ts": 1726490401520, "payload": { "delta": [0,0,5.0] } }
  ]
}
```

backend は per-run の ringbuffer (= 既定 max 5000 件、 古い分から捨てる) に積む。
process-local in-memory (= multi-process はまだ未対応、 v0.2 で考える)。

## pattern DSL (`spec_acceptance.expression` に書く JSON 文字列)

### sequence — 順序通りの出現

```json
{
  "sequence": [
    { "name": "input_w_pressed" },
    { "name": "input_w_released" }
  ],
  "within_ms": 2000
}
```

- 順に出現すれば `pass`。 途中で別 event が挟まっても OK
- `within_ms` 指定があれば、 先頭 match から末尾 match までの span が超過したら `fail`
- 1 つも match しなければ `fail` + `observed.matched_up_to=0`

### count — 出現数

```json
{
  "count": { "name": "hit_player" },
  "ge": 3,
  "within_ms": 10000
}
```

- `within_ms` 指定があれば、 先頭 event を基準に N ms 以内のみ集計
- `eq` / `ge` / `le` の組合せで判定 (複数指定可、 すべて満たせば pass)

### within — 期限内必達

```json
{
  "within_ms": 1000,
  "must_emit": { "name": "ready" }
}
```

- 先頭 event から `within_ms` 以内に `must_emit` が来れば `pass`
- 来なければ `fail`、 `observed.last_ts` で最後の event 時刻を返す

## 評価のタイミング

- per-event 評価はしない (= probe からの POST のたびに再評価しない)
- run 終了直前に `POST /api/projects/:pid/acceptance/runs/:rid/evaluate-events`
  を呼ぶと、 ringbuffer 全体を見て event-level 全 acceptance を一括評価して
  `acceptance_results` に保存
- `POST /api/projects/:pid/acceptance/runs/:rid/finish` で ringbuffer は破棄される

## level=assertion の扱い (= 別経路)

assertion level の acceptance は probe 側で評価して結果を直接 POST する:

```
POST /api/projects/:pid/acceptance/runs/:rid/results
{
  "results": [
    {
      "acceptance_id": "spec_acceptance_id",
      "status": "pass",
      "observed": { "player_speed": 5.02 },
      "duration_ms": 17
    }
  ]
}
```

= server は JS 式を eval せず、 probe (= Web の Function ベース sandboxed eval、
Unity の C# expression evaluator) に委譲する。

## v0.2+ 検討事項

- payload の where 条件 (= `{ name: "hit_player", where: { hp_lt: 30 } }`)
- パターン論理結合 (`and` / `or` / `not`)
- counter スライディングウィンドウ (= 1 秒に N 回 以上 の連続検出)
- **入力スクリプト** の再現フォーマット (= 「W を 1 秒押す」 等、 別 spec で切り出す)
- multi-process ringbuffer (= Redis backed buffer)

## 関連

- `spec/schema/spec.md` — `spec_acceptance.level` / `expression`
- `spec/schema/acceptance.md` — `acceptance_runs` / `acceptance_results`
- `server/src/lib/event-buffer.ts` — 実装
- `server/src/routes/acceptance.ts` — events / evaluate-events endpoints
