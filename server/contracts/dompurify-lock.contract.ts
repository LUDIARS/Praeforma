import { isDeepStrictEqual } from 'node:util';

export default {
  post: (result: boolean, before: unknown, after: unknown): boolean => {
    const oldLock = before as { packages: Record<string, Record<string, unknown>> };
    const newLock = after as typeof oldLock;
    const expected = structuredClone(oldLock);
    const dompurifyPackage = expected.packages['node_modules/dompurify'];
    if (!dompurifyPackage) return false;
    Object.assign(dompurifyPackage, {
      version: '3.4.17',
      resolved: 'https://registry.npmjs.org/dompurify/-/dompurify-3.4.17.tgz',
      integrity: 'sha512-B/pSlYVHQ58kqISD/yDjuJ1yfzI34m1gF4lAod2bwSRhiN4K5Cl3H8Af7hqB2PmTL911tdEudnnXn5FnhRoz0w==',
    });
    return result === isDeepStrictEqual(expected, newLock);
  },
};
