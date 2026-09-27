# シナリオのカテゴリと体験

`ux_scenarios` に category (`gameplay` / `expression`, default `gameplay`)、
experience (text, default 空)、visual_direction (text, default 空) を追加する。
新規作成・本文更新時は experience を必須とし、表現カテゴリでは visual_direction も必須。
旧行は空欄を保持して未定義として扱う。actor は操作主体に限定せず体験する人を示す。
既存の revision による楽観ロックを維持する。

`ux_canvases.frames[].scene_ref` は任意の `{ layout_id, frame_id, revision? }`。
同一 project のシーンへの参照を保存し、基本パーツを ux_canvases.elements へ複製しない。
elements はシナリオの追加パーツ。参照先消失時も既存の下書き・追加パーツは捨てない。
削除済みシーンへの既存参照は保持でき、表示側で利用不可を明示する。
revision は関連付け時に確認した scene document の版。版が異なる、未記録、フレームが消失、
またはシーンが削除済みなら、シナリオの検証根拠に再確認が必要と表示する。
新しい版の採用は利用者が行い、シナリオのキャンバス保存でその変更を記録する。
旧 layout_objects からの未保存 seed は revision 0 として扱う。検証対象の基本構成はシーン文書として保存する。

Postgres: migration 022。SQLite: SQLITE_ALTERS による同等の列追加。
