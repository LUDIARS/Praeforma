// 断片一覧の disposition 指定を読む (spec/feature/spec-review-home.md PF-HOME-12)。DB を読まない。
import type { FragmentDispositionState } from '../../../shared/spec-versioning.ts';
import { AppError } from './errors.ts';

export function parseDisposition(value: string | undefined): FragmentDispositionState | null {
  if (value === undefined || value === '') return null;
  if (value === 'pending' || value === 'integrated' || value === 'rejected') return value;
  throw AppError.badRequest('invalid_disposition');
}
