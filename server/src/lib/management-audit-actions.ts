// @spec 通知する保存
import type { ManagementChange } from './management-event-payload.ts';

type EventType = Pick<ManagementChange, 'entity' | 'operation'>;

const specUpdated = { entity: 'spec', operation: 'updated' } as const;
const sceneUpdated = { entity: 'scene', operation: 'updated' } as const;
const domainUpdated = { entity: 'domain', operation: 'updated' } as const;

const publishedActions = new Map<string, EventType>([
  ['spec.create', { entity: 'spec', operation: 'created' }],
  ['spec.update', specUpdated],
  ['spec.delete', { entity: 'spec', operation: 'deleted' }],
  ['spec.targets_replace', specUpdated],
  ['spec.acceptance_replace', specUpdated],
  ['layout.create', { entity: 'scene', operation: 'created' }],
  ['layout.update', sceneUpdated],
  ['layout.delete', { entity: 'scene', operation: 'deleted' }],
  ['layout.placements_replace', sceneUpdated],
  ['scene.save', sceneUpdated],
  ['domain.create', { entity: 'domain', operation: 'created' }],
  ['domain.update', domainUpdated],
  ['domain.delete', { entity: 'domain', operation: 'deleted' }],
  ['domain.definition.update', domainUpdated],
  ['domain.business.assign', domainUpdated],
  ['domain.requirement.link', domainUpdated],
]);

export function managementAuditAction(action: string): EventType | undefined {
  return publishedActions.get(action);
}
