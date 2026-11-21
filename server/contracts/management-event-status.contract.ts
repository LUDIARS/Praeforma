import type { ContractOf } from './contract-types.ts';
import type { classifyManagementEventStatus } from '../src/lib/management-events-client.ts';

export default {
  post: (result, status) => {
    if (status >= 200 && status < 300) return result === 'delivered';
    if (status >= 400 && status < 500) return result === 'refused';
    return result === 'retry';
  },
} satisfies ContractOf<typeof classifyManagementEventStatus>;
