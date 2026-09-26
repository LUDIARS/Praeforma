// ビジュアルの画像 (data URL) を 1 枚ずつ読む。一覧 API は画像を返さないので、見えている分だけ読む。
// 中身は作成後に変わらない (digest が同じ) ので、読み直さずに使い回す。
import { useQuery } from '@tanstack/react-query';
import { visualApi } from './project-visuals-api.ts';

export function useVisualImage(pid: string, id: string, digest: string): { dataUrl: string | null; failed: boolean } {
  const query = useQuery({
    queryKey: ['project-visual-image', pid, id, digest],
    queryFn: async () => (await visualApi.get(pid, id)).visual.dataUrl,
    staleTime: Infinity,
    gcTime: 10 * 60_000,
  });
  return { dataUrl: query.data ?? null, failed: query.isError };
}
