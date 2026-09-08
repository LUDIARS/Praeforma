// ドメイン定義の入力検証 (spec/feature/domain-definition-links.md)。
// PF-DL-INV1: sceneIds は空を許す (露出不足を入力エラーにしない)。

import { z } from 'zod';

export const domainDefinitionSchema = z.object({
  kind: z.enum(['core', 'business']),
  value: z.string().trim().min(1).max(4000),
  sceneIds: z.array(z.string().min(1)).max(200),
  anatomiaDomain: z.string().min(1).max(120).nullable(),
  expectedRevision: z.number().int().min(0).max(2_147_483_646),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.sceneIds).size !== value.sceneIds.length) {
    ctx.addIssue({ code: 'custom', path: ['sceneIds'], message: 'duplicate_scene' });
  }
});

export type DomainDefinitionInput = z.infer<typeof domainDefinitionSchema>;
