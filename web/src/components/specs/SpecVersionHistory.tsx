import React from 'react';
import type { SpecVersionLog } from '../../../../shared/spec-versioning.ts';
function Value({value}:{value:unknown}):React.ReactElement {
  if(value===null||value===undefined)return <span>なし</span>;
  if(typeof value!=='object')return <pre>{String(value)}</pre>;
  if(Array.isArray(value))return <div>{value.map((item,index)=><Value key={index} value={item}/>)}</div>;
  const row=value as Record<string,unknown>;
  return <div>{Object.entries(row).map(([key,item])=><div key={key}><strong>{({title:'仕様名',description:'内容',content:'内容',before:'変更前',after:'変更後',changes:'変更された仕様',fragments:'出典フラグメント',rationale:'理由',note:'リリース内容',deferred:'保留',reason:'理由'} as Record<string,string>)[key]??key}</strong><Value value={item}/></div>)}</div>;
}
export function SpecVersionHistory({logs}:{logs:SpecVersionLog[]}):React.ReactElement {
  return <section><h4>バージョンログ</h4>{logs.length?logs.map(log=><details className="spec-version-log" key={log.id}><summary><strong>{log.version}</strong> — {({'fragment-added':'フラグメント追加','spec-added':'仕様追加',reconstruction:'レコンストラクション',release:'リリース'} as Record<string,string>)[log.kind]??log.kind} / {new Date(log.created_at).toLocaleString()}</summary><Value value={log.payload}/></details>):<p>まだ履歴はありません。導入前の仕様は0.0.0の起点として扱います。</p>}</section>;
}
