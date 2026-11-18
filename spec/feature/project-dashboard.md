# プロジェクトの基本画面とダッシュボード

## 目的

2026-11-19 neco 指示:

> PfのUIがごちゃってるので、基本画面を「現在の体系仕様と断片仕様の確認」にフォーカスします。
> 「遷移図」「UX定義」を用意します。基本この3つで管理します。
> ファーストビューはダッシュボードで最新のイベントリストを記載します。断片の追加/体系化/シーンの編集などが該当します。
> フラグメントはCcないしはClaudeのスキル等で自動追加されます。

## 基本画面の構成

| 順 | タブ id | 表示名 | 仕様 |
| --- | --- | --- | --- |
| 1 | `dashboard` | ダッシュボード | 本書 |
| 2 | `spec-review` | 仕様確認 | spec-review-home.md |
| 3 | `flow-diagram` | 遷移図 | scene-map.md |
| 4 | `ux-definition` | UX定義 | ux-definition.md |

それ以外の従来タブ (仕様の編集・概要・UX・シナリオ・制約・ドメイン・アクター・シーン・データ設計・ビジュアル・企画概要書) と
要件定義モード・ScreenFlow は「その他」に入れる。既存の `?tab=` 共有 URL はそのまま開ける。

## 要件

| ID | 内容 |
| --- | --- |
| PF-DASH-1 | `?tab` が無い・不明なときの既定タブはダッシュボード。 |
| PF-DASH-2 | ダッシュボードは最近の出来事を新しい順に最大 30 件並べる。各行は時刻・種類・内容・実行者 (断片は登録元) を出す。 |
| PF-DASH-3 | 出来事の種類は 断片 (追加) / 体系化 (再構築の確定・版の記録) / シーン (追加・更新・削除・配置変更・シーン編集の保存) / 遷移 / 仕様 (体系仕様の追加・更新・削除・対象変更) / アクター。設定変更などそれ以外の操作記録は出さない。 |
| PF-DASH-4 | 断片は Cc や Claude のスキルから自動で入る前提とし、ダッシュボードに入力欄は置かない。断片の内容は 80 文字で省略する。 |
| PF-DASH-5 | 行から関係する画面へ移れる: シーンはシーン編集、断片・体系化・仕様は仕様確認、遷移は遷移図。削除済みのシーンへはリンクしない。 |
| PF-DASH-6 | 読み取り専用。プロジェクトの全ロールが見られる。 |

## API

`GET /api/projects/:pid/events?limit=N` (既定 30、上限 100、1 未満・非整数は 400 `invalid_limit`)。

```json
{ "items": [{ "id": "fragment:01H…", "kind": "fragment", "at": "2026-11-19T03:00:00.000Z",
  "title": "断片を追加", "detail": "…", "actor": "cc-skill", "target": { "kind": "fragment", "id": "01H…" } }], "limit": 30 }
```

出来事は保存しない。`spec_fragments.created_at`・`spec_version_logs`・`audit_log` (対象の action のみ) をその都度読み、
時刻を ISO に揃えて併合する (`server/src/lib/project-events.ts`)。型は `shared/project-home.ts`。
断片と版のログは audit_log に書かれていないため、それぞれの表を直接読む。

## 実装

- `server/src/lib/project-events.ts` / `server/src/routes/project-events.ts`
- `web/src/components/dashboard/ProjectDashboard.tsx`
- `web/src/components/ProjectTabs.tsx` — 4 画面を先頭に固定、既定をダッシュボードに。

## 検証

`server/src/lib/__tests__/project-events.test.ts` (時刻の正規化・併合順・対象外の除外・limit)。
