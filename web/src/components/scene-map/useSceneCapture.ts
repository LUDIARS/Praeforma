import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { projectHomeApi } from '../../lib/project-home-api.ts';

/** シーンのキャプチャを object URL にして返す。キャプチャが無いシーンは読みに行かない。 */
export function useSceneCapture(pid: string, lid: string, enabled: boolean): string | null {
  const query = useQuery({
    queryKey: ['scene-capture', pid, lid], queryFn: () => projectHomeApi.sceneCapture(pid, lid),
    enabled, staleTime: 60_000, retry: false,
  });
  const [url, setUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!query.data) { setUrl(null); return; }
    const next = URL.createObjectURL(query.data);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [query.data]);
  return url;
}
