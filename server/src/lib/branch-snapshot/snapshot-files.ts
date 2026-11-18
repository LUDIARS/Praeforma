// ブランチに置く設計データの写し (spec/feature/branch-snapshot.md)。
// 基本のデータ構造は pf-data 以前の設計どおり、書き出しモデル (lib/export) から model.json / spec.md / flow.mmd を作る。DB を読まない純関数。
import type { ExportModel } from '../export/model.ts';
import { renderFlowMermaid } from '../export/flow-mermaid.ts';
import { renderSpecMarkdown } from '../export/spec-markdown.ts';
import { stableJson } from './stable-json.ts';
import { SNAPSHOT_DIR, SNAPSHOT_FORMAT, SNAPSHOT_MANIFEST, type SnapshotFile, type SnapshotManifest } from './snapshot-manifest.ts';

export type { SnapshotFile };


/** 写しのファイル一式。manifest は自分以外の生成ファイルを列挙する (人が足したファイルを消さないため)。 */
export function buildSnapshotFiles(model: ExportModel, specVersion: string): SnapshotFile[] {
  const files: SnapshotFile[] = [
    { path: `${SNAPSHOT_DIR}/model.json`, content: stableJson(model) },
    { path: `${SNAPSHOT_DIR}/spec.md`, content: ensureNewline(renderSpecMarkdown(model)) },
    { path: `${SNAPSHOT_DIR}/flow.mmd`, content: ensureNewline(renderFlowMermaid(model)) },
  ];
  const manifest: SnapshotManifest = { format: SNAPSHOT_FORMAT, project: model.projectName, specVersion, files: files.map((f) => f.path) };
  return [{ path: SNAPSHOT_MANIFEST, content: stableJson(manifest) }, ...files];
}

function ensureNewline(text: string): string {
  return text.endsWith('\n') ? text : `${text}\n`;
}

