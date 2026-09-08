import type { ManualDocument } from '../../../shared/feature-manual.ts';
import { getToken } from './api.ts';

interface ManualDraft { document:ManualDocument; basis:'saved'|'proposal'; revision:number }
// Retain edits across SPA navigation without writing implementation material to browser storage.
const drafts=new Map<string,ManualDraft>();
const key=(pid:string,id:string):string=>`${getToken()??''}:${pid}:${id}`;
export function readManualDraft(pid:string,id:string):ManualDraft|undefined { return drafts.get(key(pid,id)); }
export function writeManualDraft(pid:string,id:string,draft:ManualDraft):void { drafts.set(key(pid,id),structuredClone(draft)); }
export function clearManualDraft(pid:string,id:string):void { drafts.delete(key(pid,id)); }
