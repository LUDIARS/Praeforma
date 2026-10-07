import type { buildConfluenceRequest } from '../src/lib/confluence-request.ts';
import type { ContractOf } from './contract-types.ts';

export default {
  post: (result, _url, origin) => {
    const target = new URL(result.url);
    return target.protocol === 'https:' && target.origin === new URL(origin).origin
      && !target.username && !target.password && result.redirect === 'error';
  },
} satisfies ContractOf<typeof buildConfluenceRequest>;
