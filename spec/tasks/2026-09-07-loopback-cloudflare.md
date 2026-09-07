---
task: loopback-cloudflare
project: Praeforma
kind: 実装
created: 2026-09-07
memory_links:
  - spec/feature/local-mode.md
---
# 他サービスと同じloopbackとCloudflare TunnelでPfを提供する

## 目的
LAN直接公開案を取りやめ、認証なしのPfをloopbackで起動し、既存Cloudflare Tunnelを利用する。

## 完了条件
- Pfは127.0.0.1のみで待ち受ける。LAN受信ルールは追加しない。
- 外部Originは明示したHTTPSの公開URLだけを許可する。
- ExのTunnel管理APIで既存ルートを確認し、Pf用ルートを追加する。
- 既存のアクセス制御とDNSを確認し、外部URLで利用できることを検証する。
- CFトークンをセッションへ取り出さない。管理APIの認証取得失敗は解決済みとしない。

## スコープ (編集可ディレクトリ)
- server/src/config.ts
- server/src/index.ts
- server/src/lib/local-access.ts
- excubitor.catalog.yaml
- spec/feature/local-mode.md
- Exの既存CF Tunnel管理APIを介したPfルート設定
