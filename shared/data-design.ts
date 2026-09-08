/** Versioned design contract, shared by authoring UI and persistence API. No runtime credentials or data values. */
export const DATA_TYPES = ['text', 'integer', 'bigint', 'decimal', 'boolean', 'date', 'timestamp', 'json', 'uuid', 'binary'] as const;
export type DataType = typeof DATA_TYPES[number];

export const PROFILE_FIELDS = {
  'users.id': { label: 'ユーザー ID', type: 'uuid' },
  'users.display_name': { label: '表示名', type: 'text' },
  'users.email': { label: 'メールアドレス', type: 'text' },
  'users.avatar_url': { label: 'アバター URL', type: 'text' },
  'user_profiles.role_title': { label: '肩書き', type: 'text' },
  'user_profiles.bio': { label: '自己紹介', type: 'text' },
  'user_profiles.expertise': { label: '専門分野', type: 'json' },
  'user_profiles.hobbies': { label: '趣味', type: 'json' },
} as const;
export type ProfileField = keyof typeof PROFILE_FIELDS;

export type LogicalStorage =
  | { kind: 'unassigned' }
  | { kind: 'cernere_profile'; field: ProfileField }
  | { kind: 'cernere_project'; projectKey: string; module: string; column: string }
  | { kind: 'service_db' | 'local' | 'object_storage'; location: string };

export interface DataField {
  id: string;
  name: string;
  type: DataType;
  required: boolean;
  primaryKey: boolean;
  description: string;
  referenceFieldId: string | null;
  personalData: boolean;
  protection: 'undecided' | 'required' | 'not_required';
  protectionNote: string;
  readAccess: string;
  writeAccess: string;
  retention: string;
  storage: LogicalStorage;
}

export interface DataSet {
  id: string;
  name: string;
  label: string;
  purpose: string;
  kind: 'master' | 'user';
  authority: string;
  cardinality: 'per_user' | 'collection';
  fields: DataField[];
}

export interface DataDesign {
  schemaVersion: 1;
  datasets: DataSet[];
}

export interface DataDesignSnapshot {
  definition: DataDesign;
  revision: number;
  updatedAt: string | null;
}

export interface DesignIssue {
  severity: 'error' | 'warning';
  path: string;
  message: string;
}

export interface DataDesignResponse {
  snapshot: DataDesignSnapshot;
  canEdit: boolean;
  issues: DesignIssue[];
}
