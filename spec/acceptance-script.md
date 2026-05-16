# acceptance-script — 入力再現スクリプトのフォーマット

[§11 Acceptance Test](praeforma.md#11-acceptance-test-の詳細) で acceptance を
自動評価する際に、 「W を 1 秒押す」 「マウスを (200, 300) にクリック」 のような
**入力シーケンスを再現可能に書く** ための DSL。

## ステータス

**未起稿** (= backlog S2)。 §11 の `probe` API は確定したが、 input 側の
フォーマットは未定。

## 候補 (draft)

### 案 A: YAML タイムライン (推奨)

```yaml
script: SCRIPT-001-PLAYER-MOVE-RIGHT
target_spec: SPEC-001-PLAYER-MOVE
timeline:
  - at: 0.0s
    type: key-down
    key: D
  - at: 1.0s
    type: key-up
    key: D
  - at: 1.5s
    type: assert     # checkpoint (= 評価)
    expression: probe.object('player').position.x > 4.5
```

- 利点: 人が読める、 git diff しやすい、 並び替えしやすい
- 欠点: 複雑な分岐 (= if/loop) を書きにくい

### 案 B: JS 関数

```js
async function run({ probe, input }) {
  input.keyDown('D');
  await input.wait(1.0);
  input.keyUp('D');
  await input.wait(0.5);
  assert(probe.object('player').position.x > 4.5);
}
```

- 利点: 表現力が高い (= loop / 条件分岐)
- 欠点: review しにくい、 security review が必要

### 案 C: Gherkin (Given/When/Then)

```gherkin
Given a player at position (0, 0, 0)
When the user holds "D" for 1.0s
Then the player x-position is greater than 4.5
```

- 利点: 非エンジニアも書ける
- 欠点: 表現に幅がない、 ステップ定義の維持が必要

## 推奨 (= 後で決める)

- v1 は **案 A (YAML)** で開始 (= 単純で deterministic)
- 複雑な script が必要になったら 案 B を allowlist 関数で追加
- Gherkin は v3+ 余裕があれば

## 関連
- §11 acceptance test 詳細 (praeforma.md)
- probe API は確定済 (= [§11.3](praeforma.md#113-runtime-probe-level-assertion-の評価器))
