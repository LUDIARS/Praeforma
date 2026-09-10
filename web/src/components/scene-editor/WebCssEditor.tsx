import React from 'react';
import { cssProperties, type WebStyle } from '../../../../shared/web-scene.ts';
import { importClassRules } from '../../../../shared/web-class-import.ts';

export function WebCssEditor({ styles, onChange, onError }: { styles: WebStyle[]; onChange: (styles: WebStyle[]) => void; onError: (error: string) => void }): React.ReactElement {
  const [css, setCss] = React.useState(''); const [device, setDevice] = React.useState<WebStyle['device']>('all');
  return <details className="panel"><summary>CSSクラス定義</summary>
    <label className="simple-field">適用先<select value={device} onChange={event => setDevice(event.target.value as WebStyle['device'])}><option value="all">共通</option><option value="desktop">PC（768px以上）</option><option value="mobile">スマホ（767px以下）</option></select></label>
    <label className="simple-field">クラスCSSを追加・更新<textarea rows={4} value={css} onChange={event => setCss(event.target.value)} placeholder=".button { color: white; background-color: blue; padding: 12px; }" /></label>
    <button type="button" onClick={() => { try {
      const incoming = importClassRules(css, device); const next = new Map(styles.map(style => [`${style.device}:${style.className}`, style]));
      for (const style of incoming) next.set(`${style.device}:${style.className}`, style);
      onChange([...next.values()]);
    } catch (e) { onError(e instanceof Error ? e.message : 'CSSを読み込めませんでした。'); } }}>CSSを適用</button>
    <p className="meta">同じクラス名を各端末で定義できます。既存の同名・同端末の規則は置換します。</p>
    <details><summary>対応するプロパティ</summary>{cssProperties.join(', ')}</details>
    {styles.map((style, index) => <div key={`${style.device}:${style.className}`}><strong>.{style.className} / {style.device}</strong><pre>{Object.entries(style.declarations).map(([key, value]) => `${key}: ${value};`).join('\n')}</pre><button type="button" onClick={() => { setCss(`.${style.className} {\n${Object.entries(style.declarations).map(([key, value]) => `${key}: ${value};`).join('\n')}\n}`); setDevice(style.device); }}>編集欄へ</button><button type="button" onClick={() => onChange(styles.filter((_, i) => i !== index))}>CSS定義を削除</button></div>)}
  </details>;
}
