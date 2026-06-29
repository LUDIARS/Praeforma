# competitive — 既存ツールとの差分

「なぜ Praeforma が新規ツールとして要るか」 を整理。 ステータス
**整理済 (実装ベース)** — Step 1.5 + 1.6 + 2 + 5-7 + 10 + 13 までで主要 5 差分は
動作可能な scaffold が揃った。

## 比較対象

| ツール | 役割 | 同様の機能 |
|---|---|---|
| Notion / Confluence | spec ドキュメント | spec のテキスト記述 |
| Figma / Miro | レイアウトモック | placeholder の配置 (2D) |
| Unity (素のまま) | ゲーム開発エディタ | 配置 + asset 差し替え (3D) |
| Jira / Linear | issue tracking | spec 単位の進捗管理 |
| Playwright / Cypress | acceptance テスト | runtime probe + assertion |
| Storybook | UI コンポーネント単体プレビュー | preview + visual swap |

## Praeforma の差分 (= 1 ツールだけで replace できないもの)

1. **「placeholder + spec + asset の三位一体」 を 1 つのデータモデルで束ねる**
   - Notion (spec) + Figma (layout) + Jira (進捗) はバラバラ → 「この spec を
     満たす実装」 が手作業で辿らないと分からない
2. **acceptance を spec の一部として書く + runtime で自動検査**
   - Playwright は実装側に貼り付くテスト、 spec とは別管理になりがち
3. **デザイナーの asset 差し替えがプランナーの spec を壊さない**
   - placeholder は spec の anchor、 asset は viewer のみ差し替え
4. **Unity / Web の double viewer**
   - 同じデータを 2 platform から触れる
5. **小規模 / 個人〜小チームに最適化**
   - Jira/Confluence は重い、 Notion はゲーム特化機能が無い、 Unity 単独は
     プランナーが触れない

## 「これは Praeforma が苦手 / やらない」

- 大規模チーム (= 1000+ オブジェクト / 数十人並列) は collab / 競合制御が苦しい
- 物理シミュレーションの正確性検証は対象外 (= 物理エンジン側に任せる)
- ピクセル単位の visual regression は対象外 (= Storybook + Chromatic 等)
- 商用ゲームエンジンの全機能 (lighting / nav mesh / 等) は Unity 側に委譲

## 関連
- README.md (= sales pitch の素材)
