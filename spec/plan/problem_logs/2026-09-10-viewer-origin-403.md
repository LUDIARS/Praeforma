# Viewer内のPraeformaが白画面になる

- Date: 2026-09-10
- Status: fixed in working tree
- Area: local origin policy
- Severity: Viewerで画面を開けない

## Summary

Cc/Pf掲載後に利用者がPfの白画面と403の可能性を報告。
実際のURLは https://web.ai-run-do.com/viewer/?service=praeforma 。
追加で https://exiv.ai-run-do.com/viewer/?service=praeforma も許可する依頼。

## Evidence

OriginなしのHTML/JS/CSS/api/health/api/projects取得は200だった。
配信HTMLのmodule scriptにはcrossorigin属性があるためブラウザはOriginを送る。
local-access.tsは自サービスのloopbackとPRAEFORMA_PUBLIC_URLのHTTPS Originだけを許可していた。
catalogの公開URLはhttps://pf.ai-run-do.comで、利用者が示したViewer Originと不一致。
ブラウザの403応答本文とconsoleは未取得。

## Regression Context

Viewerへの掲載確認だけでは、ブラウザのOrigin付き要求による画面表示を保証できなかった。

## Cause

Viewer Originが許可リストに含まれず、Origin付き要求はlocal_origin_rejected (403)になる。

## Fix Requirements

配備設定PRAEFORMA_ALLOWED_ORIGINSのCSVに明示されたHTTPS Originを追加許可する。
web.ai-run-do.comとexiv.ai-run-do.comを指定し、フロントのコードにはホスト名やViewer URIを追加しない。
既存の直接公開URLを維持する。Origin偽装、全Origin許可、Originなしの更新要求許可は行わない。
設定値がパス付きURL・HTTP・空値などなら起動時に明示エラーにする。

## Verification

単体・統合・起動テストは利用者の作業ポリシーにより未実施。
回帰確認ではViewer Originと直接公開Originの成功、別サイト・null Origin・未設定の拒否、
Originなし更新要求の拒否、module読込と画面表示を確認する必要がある。

## Follow-up

本体へのマージ後、設定とサーバコードを読み込むためExcubitor経由でPraeformaの再起動が必要。
動作確認前に白画面の解消済みとは報告しない。
