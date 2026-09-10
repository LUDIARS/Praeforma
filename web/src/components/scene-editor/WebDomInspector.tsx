import React from 'react';
import { webTags, type WebNode } from '../../../../shared/web-scene.ts';

export function WebDomInspector({ node, nodes, classes, onChange, onDelete }: { node: WebNode; nodes: WebNode[]; classes: string[]; onChange: (node: WebNode) => void; onDelete: () => void }): React.ReactElement {
  const descendants = new Set([node.id]);
  for (let i = 0; i < nodes.length; i++) for (const item of nodes) if (item.parentId && descendants.has(item.parentId)) descendants.add(item.id);
  return <div className="panel foundation-form"><h3>選択したDOM</h3>
    <label className="simple-field">タグ<select value={node.tag} onChange={event => onChange({ ...node, tag: event.target.value as WebNode['tag'] })}>{webTags.map(tag => <option key={tag}>{tag}</option>)}</select></label>
    <label className="simple-field">文言<textarea value={node.text} maxLength={4000} onChange={event => onChange({ ...node, text: event.target.value })} /></label>
    <label className="simple-field">親要素<select value={node.parentId ?? ''} onChange={event => onChange({ ...node, parentId: event.target.value || null })}><option value="">ルート</option>{nodes.filter(item => !descendants.has(item.id) && !['text', 'input', 'br', 'hr'].includes(item.tag)).map(item => <option key={item.id} value={item.id}>{item.tag} {item.text.slice(0, 30)} ({item.id.slice(0, 8)})</option>)}</select></label>
    <fieldset disabled={node.tag === 'text'}><legend>CSSクラス・属性（text以外）</legend>{Array.from(new Set([...classes, ...node.classes])).map(name => <label className="check-row" key={name}><input type="checkbox" checked={node.classes.includes(name)} onChange={event => onChange({ ...node, classes: event.target.checked ? [...node.classes, name] : node.classes.filter(item => item !== name) })} />{name}</label>)}
    {(['title', 'aria-label', 'placeholder', 'value'] as const).map(attribute => <label className="simple-field" key={attribute}>{attribute}<input value={node.attributes[attribute] ?? ''} maxLength={500} onChange={event => {
      const attributes = { ...node.attributes }; if (event.target.value) attributes[attribute] = event.target.value; else delete attributes[attribute]; onChange({ ...node, attributes });
    }} /></label>)}
    {node.tag === 'input' || node.tag === 'button' ? <label className="simple-field">type<select value={node.attributes.type ?? ''} onChange={event => {
      const attributes = { ...node.attributes }; if (event.target.value) attributes.type = event.target.value as NonNullable<WebNode['attributes']['type']>; else delete attributes.type; onChange({ ...node, attributes });
    }}><option value="">未指定</option>{['text', 'number', 'checkbox', 'radio', 'button'].map(type => <option key={type}>{type}</option>)}</select></label> : null}
    </fieldset><button type="button" className="danger" onClick={onDelete}>要素と子孫を削除</button>
  </div>;
}
