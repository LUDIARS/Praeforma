import React from 'react';
import type { DesignCanvasDocument } from '../../../../shared/design-canvas.ts';
import { webSceneSchema, webTags, type WebNode, type WebScene } from '../../../../shared/web-scene.ts';
import { sourceDiff, webCss, webMarkup } from '../../../../shared/web-scene-export.ts';
import { importMarkup } from './web-dom-import.ts';
import { WebDomPreview } from './WebDomPreview.tsx';
import { WebDomInspector } from './WebDomInspector.tsx';
import { WebCssEditor } from './WebCssEditor.tsx';
import { deviceLabels } from '../ux-design/FrameDeviceControls.tsx';

interface Props {
  canvas: DesignCanvasDocument; value: WebScene; onChange: (value: WebScene) => void; disabled: boolean;
  onUndo: () => void; onRedo: () => void; canUndo: boolean; canRedo: boolean;
}

export function WebSceneEditor({ canvas, value, onChange, disabled, onUndo, onRedo, canUndo, canRedo }: Props): React.ReactElement {
  const baseline = React.useRef(value);
  const [frameId, setFrameId] = React.useState(canvas.frames[0]?.id ?? '');
  const [selected, setSelected] = React.useState(''); const [tag, setTag] = React.useState<WebNode['tag']>('button');
  const [markup, setMarkup] = React.useState(''); const [error, setError] = React.useState('');
  const frame = canvas.frames.find(item => item.id === frameId) ?? canvas.frames[0];
  const variant = value.variants.find(item => item.frameId === frame?.id);
  const nodes = variant?.nodes ?? [];
  const tree = (parentId: string | null): WebNode[] => nodes.filter(item => item.parentId === parentId).flatMap(item => [item, ...tree(item.id)]);
  const node = nodes.find(item => item.id === selected);
  const apply = (next: WebScene): void => {
    if (disabled) return;
    const parsed = webSceneSchema.safeParse(next);
    if (!parsed.success) { setError('DOMの親子関係・タグ・文言・CSS・件数上限を確認してください。input/br/hrには文言や子要素を設定できません。'); return; }
    setError(''); onChange(parsed.data);
  };
  const replaceNodes = (next: WebNode[]): void => {
    if (!frame) return;
    apply({ ...value, variants: [...value.variants.filter(item => item.frameId !== frame.id), { frameId: frame.id, nodes: next }] });
  };
  const remove = (): void => {
    const removed = new Set([selected]);
    for (let i = 0; i < nodes.length; i++) for (const item of nodes) if (item.parentId && removed.has(item.parentId)) removed.add(item.id);
    replaceNodes(nodes.filter(item => !removed.has(item.id))); setSelected('');
  };
  const reorder = (direction: number): void => {
    if (!node) return;
    const siblings = nodes.filter(item => item.parentId === node.parentId);
    const other = siblings[siblings.indexOf(node) + direction]; if (!other) return;
    const next = [...nodes], a = next.indexOf(node), b = next.indexOf(other); next[a] = other; next[b] = node; replaceNodes(next);
  };
  const html = frame ? webMarkup(value, frame.id) : '', css = webCss(value);
  const diff = frame ? sourceDiff(webMarkup(baseline.current, frame.id), html, 'scene.html') + sourceDiff(webCss(baseline.current), css, 'scene.css') : '';
  return <section className="panel"><h2>WebUI DOM / CSS</h2>
    <p className="meta">画面を選び、DOMを取り込むか要素を追加してください。プレビューの要素をクリックして選択できます。プレビュー中はアプリの処理を実行しません。</p>
    <label className="simple-field">編集する画面<select value={frame?.id ?? ''} onChange={event => { setFrameId(event.target.value); setSelected(''); }}>{canvas.frames.map(item => <option key={item.id} value={item.id}>{item.name} / {deviceLabels[item.device ?? 'unspecified']} / {item.viewport.width}×{item.viewport.height}</option>)}</select></label>
    {!frame ? <p>配置エディタでPC画面・スマホ画面を追加してください。</p> : <>
      {error ? <p role="alert" className="err-text">{error}</p> : null}
      <fieldset disabled={disabled} className="foundation-form">
        <button type="button" disabled={!canUndo} onClick={onUndo}>DOM/CSSを元に戻す</button><button type="button" disabled={!canRedo} onClick={onRedo}>やり直す</button>
        <details><summary>HTMLを取り込む</summary><label className="simple-field">HTML本文<textarea rows={5} value={markup} onChange={event => setMarkup(event.target.value)} /></label><button type="button" onClick={() => {
          try { const imported = importMarkup(markup, () => crypto.randomUUID());
            if (nodes.length && !window.confirm('この画面のDOMを取り込み内容で置き換えますか？')) return;
            replaceNodes(imported); setSelected('');
          } catch (e) { setError(e instanceof Error ? e.message : 'HTMLを読み込めませんでした。'); }
        }}>この画面へ取り込む</button><p className="meta">対応する構造タグと文言・class・title・aria-label・placeholder・value・typeを取り込みます。styleはCSS欄で定義してください。未対応のタグや属性はエラーで知らせます。</p></details>
        <label className="simple-field">追加するタグ<select value={tag} onChange={event => setTag(event.target.value as WebNode['tag'])}>{webTags.map(item => <option key={item}>{item}</option>)}</select></label>
        <button type="button" onClick={() => { const id = crypto.randomUUID(); replaceNodes([...nodes, { id, parentId: node && !['input', 'br', 'hr', 'text'].includes(node.tag) ? node.id : null, tag, text: ['input', 'br', 'hr'].includes(tag) ? '' : '新しい要素', classes: [], attributes: {} }]); setSelected(id); }}>DOM要素を追加</button>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}><nav aria-label="DOMツリー" style={{ maxHeight: 450, overflow: 'auto', minWidth: 220 }}>{tree(null).map(item => {
          let depth = 0, parent = item.parentId; while (parent && depth < 32) { depth++; parent = nodes.find(candidate => candidate.id === parent)?.parentId ?? null; }
          return <button type="button" key={item.id} style={{ display: 'block', marginLeft: depth * 12 }} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>{item.tag} {item.text.slice(0, 24)} {item.classes.map(name => '.' + name).join(' ')}</button>;
        })}</nav>{node ? <div><button type="button" onClick={() => reorder(-1)}>上へ</button><button type="button" onClick={() => reorder(1)}>下へ</button><WebDomInspector node={node} nodes={nodes} classes={value.styles.map(style => style.className)} onChange={next => replaceNodes(nodes.map(item => item.id === next.id ? next : item))} onDelete={remove} /></div> : null}</div>
        <WebCssEditor styles={value.styles} onChange={styles => apply({ ...value, styles })} onError={setError} />
      </fieldset>
      <WebDomPreview scene={value} frameId={frame.id} width={frame.viewport.width} height={frame.viewport.height} onSelect={setSelected} />
      <details><summary>HTML / CSS / 変更差分</summary><p>この編集画面を開いた時点との差分です。HTML/CSSとしてレビューし、React等の実装へ適用してください。</p><label className="simple-field">HTML<textarea readOnly rows={8} value={html} /></label><label className="simple-field">CSS<textarea readOnly rows={8} value={css} /></label><label className="simple-field">差分<textarea readOnly rows={8} value={diff || '変更なし'} /></label><button type="button" onClick={() => {
        const url = URL.createObjectURL(new Blob([JSON.stringify({ frame: { name: frame.name, device: frame.device, viewport: frame.viewport }, html, css, diff }, null, 2)], { type: 'application/json;charset=utf-8' }));
        const link = document.createElement('a'); link.href = url; link.download = 'webui-scene-changes.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
      }}>HTML・CSS・差分をダウンロード</button></details>
    </>}
  </section>;
}
