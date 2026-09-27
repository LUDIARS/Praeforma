export interface ProjectFilters { query: string; team: string }
export interface ProjectIndexRow { name: string; description: string | null; orgId: string }
const normalize = (value: string): string => value.normalize('NFKC').toLowerCase();
/** Filter before pagination, including names on later pages. */
export function filterProjects<T extends ProjectIndexRow>(projects: readonly T[], filters: ProjectFilters): T[] {
  const words = normalize(filters.query.trim()).split(/\s+/).filter(Boolean);
  return projects.filter(project => (!filters.team || project.orgId === filters.team)
    && words.every(word => normalize(`${project.name}\n${project.description ?? ''}\n${project.orgId}`).includes(word)));
}
export interface SavedProjectFilters extends ProjectFilters { remember: boolean }
export const PROJECT_FILTER_KEY = 'praeforma.project-filters.v1';
export const defaultProjectFilters = (): SavedProjectFilters => ({ query: '', team: '', remember: true });
export function parseProjectFilters(raw: string | null): SavedProjectFilters {
  if (!raw) return defaultProjectFilters();
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return defaultProjectFilters(); }
  if (!value || typeof value !== 'object') return defaultProjectFilters();
  const item = value as Record<string, unknown>;
  if (item.remember === false) return { query: '', team: '', remember: false };
  if (typeof item.query !== 'string' || typeof item.team !== 'string' || item.query.length > 200 || item.team.length > 500) return defaultProjectFilters();
  return { query: item.query, team: item.team, remember: true };
}
export function serializeProjectFilters(value: SavedProjectFilters): string {
  return JSON.stringify(value.remember ? value : { remember: false });
}
