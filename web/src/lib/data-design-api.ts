/** Transport for project-owned design documents. */
import { req } from './api.ts';
import type { DataDesign, DataDesignResponse } from '../../../shared/data-design.ts';

export function getDataDesign(pid: string): Promise<DataDesignResponse> {
  return req('/api/projects/' + encodeURIComponent(pid) + '/data-design');
}

export function saveDataDesign(pid: string, definition: DataDesign, expectedRevision: number): Promise<DataDesignResponse> {
  return req('/api/projects/' + encodeURIComponent(pid) + '/data-design', {
    method: 'PUT', body: JSON.stringify({ definition, expectedRevision }),
  });
}
