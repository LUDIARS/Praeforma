import type { PoolClient } from 'pg';
import { getDbState,getLocalSqlite } from './connection.ts';
import { AppError } from '../lib/errors.ts';
export interface VersionStatement { sql:string;args: Array<string|number|null>;affected?:number;lock?:boolean;check?:(rows:Record<string,unknown>[])=>boolean }
const pgSql=(sql:string):string=>{let index=0;return sql.replace(/\?/g,()=>`$${++index}`);};
export async function versionRows(sql:string,args:Array<string|number|null>=[]):Promise<Record<string,unknown>[]> {
  const sqlite=getLocalSqlite(); if(sqlite)return sqlite.prepare(sql).all(...args) as Record<string,unknown>[];
  const pool=getDbState().pool;if(!pool)throw AppError.internal('db_unavailable');return (await pool.query(pgSql(sql),args)).rows as Record<string,unknown>[];
}
/** Synchronous SQLite transaction; PostgreSQL statements share one checked-out connection. */
export async function versionBatch(steps:VersionStatement[]):Promise<void> {
  const sqlite=getLocalSqlite();
  if(sqlite){
    sqlite.transaction(()=>{for(const step of steps){
      if(step.check){if(!step.check(sqlite.prepare(step.sql).all(...step.args) as Record<string,unknown>[]))throw AppError.conflict('spec_version_conflict');}
      else {const result=sqlite.prepare(step.sql).run(...step.args);if(step.affected!==undefined&&result.changes!==step.affected)throw AppError.conflict('spec_version_conflict');}
    }})();return;
  }
  const pool=getDbState().pool;if(!pool)throw AppError.internal('db_unavailable');const client:PoolClient=await pool.connect();
  try {await client.query('BEGIN');for(const step of steps){const result=await client.query(pgSql(step.sql)+(step.lock?' FOR UPDATE':''),step.args);
    if((step.affected!==undefined&&result.rowCount!==step.affected)||(step.check&&!step.check(result.rows as Record<string,unknown>[])))throw AppError.conflict('spec_version_conflict');
  }await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
export function parseStored<T>(value:unknown):T {return (typeof value==='string'?JSON.parse(value):value) as T;}
