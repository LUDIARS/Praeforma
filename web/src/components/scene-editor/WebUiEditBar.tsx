import React from 'react';

/** Scene save state, surfaced inside the full-screen editor where the canvas toolbar is hidden. */
export interface WebSceneSaveControl { onSave: () => void; canSave: boolean; isSaving: boolean; isDirty: boolean; hasFailed: boolean }

/** Phone-width bar (hidden on PC by scene-editor.css): open, save and close full-screen UI editing (PF-WEB-9). */
export function WebUiEditBar({ isEditing, onOpen, onClose, save }: { isEditing: boolean; onOpen: () => void; onClose: () => void; save: WebSceneSaveControl }): React.ReactElement {
  if (!isEditing) return <div className="web-ui-edit-bar"><button type="button" className="primary" onClick={onOpen}>全画面でUIを編集</button></div>;
  return <div className="web-ui-edit-bar" role="toolbar" aria-label="UI編集">
    <strong>UI編集</strong>
    <span className="meta" role="status">{save.isSaving ? '保存中…' : save.isDirty ? '未保存の変更があります' : '保存済み'}</span>
    <button type="button" className="primary" disabled={!save.canSave || !save.isDirty || save.isSaving} onClick={save.onSave}>保存</button>
    <button type="button" className="ghost" onClick={onClose}>編集を閉じる</button>
    {save.hasFailed ? <p role="alert" className="err-text">保存できませんでした。権限・入力内容を確認してください。他の変更と競合した場合は、編集内容を控えてから開き直してください。</p> : null}
  </div>;
}
