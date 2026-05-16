// LUDIARS 標準の pagination。

import { AppError } from './errors.ts';

export interface PageParams {
  limit: number;
  offset: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export function parsePagination(query: Record<string, string | undefined>): PageParams {
  const rawLimit = query.limit;
  const rawOffset = query.offset;
  const limit = rawLimit ? Math.min(Number(rawLimit), MAX_LIMIT) : DEFAULT_LIMIT;
  const offset = rawOffset ? Number(rawOffset) : 0;
  if (!Number.isFinite(limit) || limit <= 0) {
    throw AppError.badRequest('invalid_limit');
  }
  if (!Number.isFinite(offset) || offset < 0) {
    throw AppError.badRequest('invalid_offset');
  }
  return { limit, offset };
}
