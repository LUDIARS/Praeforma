import { req } from './api.ts';

export interface DefinedDomain {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  definitionKind: 'core' | 'business' | null;
  definitionValue: string;
  definitionSceneIds: string[];
  definitionRevision: number;
  anatomiaDomain: string | null;
}
export interface DomainDefinitions {
  items: DefinedDomain[];
  scenes: Array<{ id: string; name: string }>;
  requirements: Array<{ id: string; code: string; title: string }>;
  links: Array<{ specId: string; domainId: string }>;
}
export interface DefinitionInput {
  kind: 'core' | 'business'; value: string; sceneIds: string[];
  anatomiaDomain: string | null; expectedRevision: number;
}
export const domainDefinitionsApi = {
  assignBusiness: (pid: string, coreId: string, businessId: string) => req<{ assigned: boolean }>(
    `/api/projects/${pid}/domain-definitions/${coreId}/business-domains/${businessId}`, { method: 'POST' }),
  read: (pid: string) => req<DomainDefinitions>(`/api/projects/${pid}/domain-definitions`),
  save: (pid: string, did: string, body: DefinitionInput) => req<{ revision: number }>(
    `/api/projects/${pid}/domain-definitions/${did}`, { method: 'PUT', body: JSON.stringify(body) }),
  linkRequirement: (pid: string, did: string, sid: string, linked: boolean) => req<{ linked: boolean }>(
    `/api/projects/${pid}/domain-definitions/${did}/requirements/${sid}`,
    { method: 'PUT', body: JSON.stringify({ linked }) }),
  catalog: (pid: string) => req<{ catalog: Array<{ name: string; description: string | null }> }>(`/api/projects/${pid}/anatomia/domains`),
};
