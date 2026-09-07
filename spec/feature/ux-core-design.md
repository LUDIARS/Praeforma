# UX・コアドメイン設計

Praeforma は、画面仕様だけでなく、体験を成立させるコアドメインの責務と境界を設計する。
画面・シーン・frame と domain の直接関連は作らない。境界候補は UX scenario と use case の
意図、成功、失敗、中断復帰、業務ルールから生成する。

## 設計フロー

1. 人間が UX scenario と use case を記述する。
2. LLM が use case を責務、業務ルール、境界候補へ分解する。候補は未承認である。
3. Genius から類似判断カードを検索する。LLM は各カードが各候補へ適用可能、不適用、未確定の
   どれかを根拠付きで評価し、追加の人間判断点を作る。検索結果にない card id は受理しない。
4. 人間が候補を採用、棄却、修正、分割、統合し、理由と最終境界を記録する。
5. 人間判断後に限り、その判断を Genius へカードとして送る。送信の失敗は判断自体を取り消さず、
   `geniusPublishStatus=failed` として残す。ネットワーク結果が不明な送信を自動再試行しない。

`classification=core` の採用結果だけを Praeforma のコア境界として扱う。
`supporting` と `generic` は `externalized` と表示し、Anatomia 管理へ引き渡す対象とする。
Praeforma から Anatomia の Gate A を代理承認しない。

## 権限

scenario / use case / canvas の本文編集は `owner` / `planner` / `designer` が行う。
解析、判断、証拠登録は `owner` / `planner` / `reviewer` が行う。
scenario の `status='reviewed'` は「人間がレビューした」と主張する唯一の遷移なので、
本文編集ではなくレビュー権限側に属する。編集権限だけを持つ利用者はこの遷移を行えない。

proposal の status は判断履歴から投影する。同一時刻の判断が並んだ場合も、判断 id (ULID) の
降順を副次キーとして最新判断を一意に決める。`accepted` と `externalized` の区別を
保存順の実装差に委ねない。

## 画面フロー・画像解析

scenario は独立した canvas を持つ。canvas の frame は画面仕様と loading / empty / error などの
状態を持つ。element は複雑な UI を `box` で表現できる。動的要素は sample と更新条件を、追従 UI は
追従先と条件を保持する。transition は frame または frame 上の element を起点にする。

canvas は revision の CAS で保存する。follow は同一 frame 内に限定し、循環を拒否する。
transition の起点 element は起点 frame に所属しなければならない。

画像解析は multipart の画像を最大 10 MiB まで受け付ける。Content-Type と magic bytes を照合し、
画像 bytes を Claude CLI の image content block として明示的に渡す。原画像は保存しない。
解析案は既存 canvas と別 ID で追加し、採用前の編集内容を上書きしない。同じ解析の二重適用は拒否する。

## 実装・検証証拠

evidence は scenario / use case / proposal のいずれかを対象にし、次を必須にする。

- 証拠を得た project key（例: `Mp` または `MN`）
- source revision と安定した source ref
- evidence 記録時の scenario revision
- use case 対象なら use case revision
- canvas を検証した場合は canvas revision

現在の版と異なる証拠は `isStale=true` として返す。`Mp` と `MN` は別の `sourceProjectKey` であり、
Mp の成功を MN の検証済み状態へ集計しない。Anatomia の実装取得結果は選択グラフそのものの
SHA-256 を source revision とし、同時取得した knowledge head を payload に残す。

## Mp での初期題材

初期題材は Mp の「投げ縄が当たる → 押し続けて引き寄せ → 捕獲または縄抜け → 再試行」とする。
利用者は `sourceProjectKey=Mp` と参照先を入力する。private repository の仕様本文、写真、画像、
その他の実 asset は Praeforma に複製しない。

## 外部設定

- `PRAEFORMA_ANATOMIA_URL`: Anatomia API base URL
- `PRAEFORMA_ANATOMIA_TOKEN`: Anatomia bearer token（必要な環境のみ）
- `PRAEFORMA_GENIUS_URL`: Genius API base URL
- `PRAEFORMA_CLAUDE_BIN`: 境界・画像解析に使う Claude CLI
- `PRAEFORMA_CLAUDE_MODEL`: CLI に固定する model

未設定や upstream failure を空の成功、mock、承認済み状態へ置き換えない。
