import { useQueries } from '@tanstack/react-query';
import { sceneApi } from '../../lib/scene-editor-api.ts';
import type { SceneDocument } from '../../../../shared/scene-editor.ts';
import type { SceneLayer } from '../../../../shared/scene-layers.ts';

export interface LayerSceneSource {
  layoutId: string;
  name: string | null;
  document: SceneDocument | null;
  isLoading: boolean;
  isUnavailable: boolean;
}

/** Same key as SceneEditorPage, so opening a layered scene and layering it share one cache entry. */
export const sceneQueryKey = (pid: string, layoutId: string) => ['scene-editor', pid, layoutId] as const;

/** Reads every layered scene through the project-scoped scene API; failures stay visible per scene. PF-SCENE-8. */
export function useSceneLayerSources(pid: string, layers: readonly SceneLayer[]): ReadonlyMap<string, LayerSceneSource> {
  const layoutIds = [...new Set(layers.map(layer => layer.layoutId))];
  const results = useQueries({
    queries: layoutIds.map(layoutId => ({
      queryKey: sceneQueryKey(pid, layoutId),
      queryFn: () => sceneApi.get(pid, layoutId),
      retry: false,
      refetchOnWindowFocus: false,
    })),
  });
  return new Map(layoutIds.map((layoutId, index) => {
    const result = results[index];
    return [layoutId, {
      layoutId,
      name: result?.data?.name ?? null,
      document: result?.data?.document ?? null,
      isLoading: result?.isPending ?? true,
      isUnavailable: result?.isError ?? false,
    }];
  }));
}
