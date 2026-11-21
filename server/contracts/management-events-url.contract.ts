import type { ContractOf } from './contract-types.ts';
import type { resolveManagementEventsUrl } from '../src/lib/management-events-client.ts';

export default {
  post: (url, env) => {
    const explicit = env.CONCORDIA_MANAGEMENT_EVENTS_URL?.trim();
    const base = env.CONCORDIA_URL?.trim();
    const setting = explicit || base;
    if (!setting || setting.toLowerCase() === 'off') return url === null;
    const configured = new URL(setting);
    return url === (explicit ? configured.href : `${configured.origin}/v1/management/events`);
  },
} satisfies ContractOf<typeof resolveManagementEventsUrl>;
