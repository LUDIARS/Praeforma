/** Structural API boundary for data design. Semantic rules are shared with the editor. */
import { z } from 'zod';
import { DATA_TYPES, PROFILE_FIELDS, type DataDesign } from '../../../shared/data-design.ts';

const note = z.string().max(4000);
const logicalStorage = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('unassigned') }).strict(),
  z.object({ kind: z.literal('cernere_profile'), field: z.string().refine(
    (value): value is keyof typeof PROFILE_FIELDS => Object.hasOwn(PROFILE_FIELDS, value),
    'Unknown Cernere profile field',
  ) }).strict(),
  z.object({ kind: z.literal('cernere_project'), projectKey: z.string().max(63),
    module: z.string().max(100), column: z.string().max(63) }).strict(),
  z.object({ kind: z.literal('service_db'), location: z.string().max(500) }).strict(),
  z.object({ kind: z.literal('local'), location: z.string().max(500) }).strict(),
  z.object({ kind: z.literal('object_storage'), location: z.string().max(500) }).strict(),
]);

const field = z.object({
  id: z.string().uuid(), name: z.string().max(63), type: z.enum(DATA_TYPES),
  required: z.boolean(), primaryKey: z.boolean(), description: note,
  referenceFieldId: z.string().uuid().nullable(), personalData: z.boolean(),
  protection: z.enum(['undecided', 'required', 'not_required']),
  protectionNote: note, readAccess: note, writeAccess: note, retention: note,
  storage: logicalStorage,
}).strict();

export const dataDesignSchema: z.ZodType<DataDesign, z.ZodTypeDef, unknown> = z.object({
  schemaVersion: z.literal(1),
  datasets: z.array(z.object({
    id: z.string().uuid(), name: z.string().max(63), label: z.string().max(200),
    purpose: note, kind: z.enum(['master', 'user']), authority: z.string().max(500),
    cardinality: z.enum(['per_user', 'collection']), fields: z.array(field).max(100),
  }).strict()).max(100),
}).strict();

export const saveDataDesignSchema = z.object({
  definition: dataDesignSchema,
  expectedRevision: z.number().int().min(0).max(2_147_483_646),
}).strict();
