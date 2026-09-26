// 企画概要書の書き込み (spec/feature/concept-sheet.md PF-CS-6 / PF-CS-10 / PF-CS-11)。
// 最新版の行 (concept_sheets) と版 (concept_sheet_versions) は同じトランザクションで書き、片方だけが残らないようにする。
import { eq, and } from 'drizzle-orm';
import { getDb } from './connection.ts';
import { conceptSheets, type ConceptSheetPayload, type ConceptSheetVersionPayload } from './schema/concept-sheet.ts';
import { runDualTransaction, dialectTime, type DualStatement } from './dual-dialect.ts';
import { purgeUnreferencedVisuals } from './project-visual-persistence.ts';
import { AppError } from '../lib/errors.ts';
import type {
  ConceptSheetDesign, ConceptSheetSource, ConceptSheetVersionKind, ConceptSheetVisualRef,
} from '../../../shared/concept-sheet.ts';

export interface ConceptSheetVersionWrite {
  id: string;
  projectId: string;
  /** 0 = 作成 (rv1)。それ以外は最新版の revision と一致したときだけ次の版を足す。 */
  expectedRevision: number;
  kind: Exclude<ConceptSheetVersionKind, 'migrated'>;
  createdBy: string;
  design: ConceptSheetDesign;
  source: ConceptSheetSource;
  visualRefs: ConceptSheetVisualRef[];
}

const revisionConflict = (r: { changes: number }): AppError | null =>
  (r.changes === 1 ? null : AppError.conflict('concept_sheet_revision_conflict'));

/** 最新版の行を作る / 次の版へ進める文。削除済みプロジェクトには書かない。 */
function headStatement(w: ConceptSheetVersionWrite, payload: string, now: Date): DualStatement {
  if (w.expectedRevision === 0) {
    return {
      sqlite: 'INSERT INTO concept_sheets(id,project_id,payload,revision,updated_at,auto_update,latest_rv) SELECT ?,id,?,1,?,1,1 FROM projects WHERE id=? AND deleted_at IS NULL ON CONFLICT(id) DO NOTHING',
      pg: 'INSERT INTO concept_sheets(id,project_id,payload,revision,updated_at,auto_update,latest_rv) SELECT $1::text,id,$2::jsonb,1,$3::timestamptz,true,1 FROM projects WHERE id=$4 AND deleted_at IS NULL ON CONFLICT(id) DO NOTHING',
      args: (d) => [w.id, payload, dialectTime(d, now), w.projectId],
      verify: revisionConflict,
    };
  }
  return {
    sqlite: 'UPDATE concept_sheets SET payload=?,revision=revision+1,latest_rv=latest_rv+1,updated_at=? WHERE id=? AND project_id=? AND revision=? AND EXISTS(SELECT 1 FROM projects WHERE id=? AND deleted_at IS NULL)',
    pg: 'UPDATE concept_sheets SET payload=$1::jsonb,revision=revision+1,latest_rv=latest_rv+1,updated_at=$2 WHERE id=$3 AND project_id=$4 AND revision=$5 AND EXISTS(SELECT 1 FROM projects WHERE id=$6 AND deleted_at IS NULL)',
    args: (d) => [payload, dialectTime(d, now), w.id, w.projectId, w.expectedRevision, w.projectId],
    verify: revisionConflict,
  };
}

/**
 * 版が指すビジュアルが残っていて、中身が生成に使ったものと同じか。削除の印が付いた行は画像が残るのでよい。
 * 生成の途中で印の無い削除 (どの版も使っていなかった行の削除) が入ると、この版は画像を失うので保存しない。
 */
function visualsStatement(projectId: string, refs: ConceptSheetVisualRef[]): DualStatement {
  const ids = [...new Set(refs.map((r) => r.visualId))];
  return {
    sqlite: `SELECT id, digest FROM project_visuals WHERE project_id=? AND id IN (${ids.map(() => '?').join(',')})`,
    args: () => [projectId, ...ids],
    verify: ({ rows }) => {
      const digests = new Map(rows.map((row) => [String(row.id), String(row.digest)]));
      return refs.every((r) => digests.get(r.visualId) === r.digest) ? null : AppError.conflict('concept_sheet_visual_removed');
    },
  };
}

/** 作成は rv1、作り直し・自動更新は最新版の次の番号で版を足す。戻り値は新しい revision と rv。 */
export async function persistConceptSheetVersion(w: ConceptSheetVersionWrite): Promise<{ revision: number; rv: number }> {
  const now = new Date();
  const head: ConceptSheetPayload = { design: w.design, source: w.source, visualRefs: w.visualRefs };
  const version: ConceptSheetVersionPayload = { design: w.design, source: w.source };
  const statements: DualStatement[] = [headStatement(w, JSON.stringify(head), now)];
  if (w.visualRefs.length > 0) statements.push(visualsStatement(w.projectId, w.visualRefs));
  statements.push({
    sqlite: 'INSERT INTO concept_sheet_versions(sheet_id,rv,project_id,payload,visual_refs,kind,created_by,created_at) SELECT id,latest_rv,project_id,?,?,?,?,? FROM concept_sheets WHERE id=? AND project_id=?',
    pg: 'INSERT INTO concept_sheet_versions(sheet_id,rv,project_id,payload,visual_refs,kind,created_by,created_at) SELECT id,latest_rv,project_id,$1::jsonb,$2::jsonb,$3::text,$4::text,$5::timestamptz FROM concept_sheets WHERE id=$6 AND project_id=$7',
    args: (d) => [JSON.stringify(version), JSON.stringify(w.visualRefs), w.kind, w.createdBy, dialectTime(d, now), w.id, w.projectId],
    verify: revisionConflict,
  }, {
    sqlite: 'SELECT revision, latest_rv FROM concept_sheets WHERE id=? AND project_id=?',
    args: () => [w.id, w.projectId],
  });
  const results = await runDualTransaction(statements);
  const row = results.at(-1)?.rows[0];
  return { revision: Number(row?.revision), rv: Number(row?.latest_rv) };
}

/** 版一致で削除する。別の人の更新を消さない。版も消し、どの版も使わなくなった削除済みのビジュアルを片付ける。 */
export async function deleteConceptSheet(id: string, projectId: string, expectedRevision: number): Promise<void> {
  await runDualTransaction([
    { sqlite: 'DELETE FROM concept_sheets WHERE id=? AND project_id=? AND revision=?', args: () => [id, projectId, expectedRevision],
      verify: revisionConflict },
    { sqlite: 'DELETE FROM concept_sheet_versions WHERE sheet_id=? AND project_id=?', args: () => [id, projectId] },
  ]);
  await purgeUnreferencedVisuals(projectId);
}

/** 自動更新の ON/OFF (PF-CS-11)。紙面は変えないので revision は進めない (作り直しと競合させない)。 */
export async function setConceptSheetAutoUpdate(id: string, projectId: string, enabled: boolean): Promise<void> {
  const rows = await getDb().update(conceptSheets).set({ autoUpdate: enabled })
    .where(and(eq(conceptSheets.id, id), eq(conceptSheets.projectId, projectId))).returning({ id: conceptSheets.id });
  if (rows.length !== 1) throw AppError.notFound('concept_sheet_not_found');
}
