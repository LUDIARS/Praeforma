/** Creation and removal of stable draft entities, including same-document references. */
import type { DataDesign, DataField, DataSet } from '../../../shared/data-design.ts';

function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // LAN の HTTP では randomUUID が使えない。利用可能な暗号学的乱数で同じ UUID v4 を作る。
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}

function nextName(prefix: string, existing: readonly string[]): string {
  const names = new Set(existing);
  let suffix = 1;
  while (names.has(prefix + suffix)) suffix++;
  return prefix + suffix;
}

export function createDataSet(existing: readonly DataSet[]): DataSet {
  return { id: newId(), name: nextName('data_', existing.map((item) => item.name)),
    label: '', purpose: '', kind: 'user', authority: '', cardinality: 'per_user', fields: [] };
}

export function createDataField(existing: readonly DataField[]): DataField {
  return { id: newId(), name: nextName('field_', existing.map((item) => item.name)),
    type: 'text', required: false, primaryKey: false, description: '', referenceFieldId: null,
    personalData: false, protection: 'undecided', protectionNote: '', readAccess: '', writeAccess: '',
    retention: '', storage: { kind: 'unassigned' } };
}

/** Callers confirm the removal; all inbound references are explicitly cleared together. */
export function removeDesignEntities(design: DataDesign, datasetId: string, fieldId?: string): DataDesign {
  const dataset = design.datasets.find((item) => item.id === datasetId);
  if (!dataset) return design;
  const removedIds = new Set(fieldId ? [fieldId] : dataset.fields.map((field) => field.id));
  return { ...design, datasets: design.datasets.filter((item) => fieldId || item.id !== datasetId)
    .map((item) => ({ ...item, fields: item.fields.filter((field) => !removedIds.has(field.id))
      .map((field) => field.referenceFieldId && removedIds.has(field.referenceFieldId)
        ? { ...field, referenceFieldId: null } : field) })) };
}
