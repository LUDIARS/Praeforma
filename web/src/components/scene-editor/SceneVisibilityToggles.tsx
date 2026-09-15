import React from 'react';

export interface SceneVisibilityItem { layoutId: string; name: string }

interface Props {
  scenes: readonly SceneVisibilityItem[];
  hidden: ReadonlySet<string>;
  onChange: (hidden: ReadonlySet<string>) => void;
}

/** Per-scene show/hide is a viewer choice: available without edit rights and never saved. PF-SCENE-8. */
export function SceneVisibilityToggles({ scenes, hidden, onChange }: Props): React.ReactElement {
  return <fieldset className="scene-visibility">
    <legend>シーンごとの表示</legend>
    {scenes.map(scene => <label key={scene.layoutId} className="check-row"><input type="checkbox" checked={!hidden.has(scene.layoutId)} onChange={event => {
      const next = new Set(hidden);
      if (event.target.checked) next.delete(scene.layoutId); else next.add(scene.layoutId);
      onChange(next);
    }} />{scene.name}</label>)}
    <p className="meta">表示の切り替えは見え方だけを変え、シーンには保存しません。</p>
  </fieldset>;
}
