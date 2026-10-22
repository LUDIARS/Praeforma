import type { DesignCanvasDocument } from './design-canvas.ts';

/**
 * PF-SCENE-9: シーンの「役割」を描画物から切り離して読むための派生ビュー。
 * キャンバスは形と文字だけを描き、各要素が何を表し、何に応じて変わり、どこへ遷移するかはここから組み立てる。
 * 保存対象ではなく、canvas から毎回決定的に作る。
 */
type RoleCanvas = Pick<DesignCanvasDocument, 'frames' | 'elements' | 'transitions'>;

export interface SceneRoleTransition {
  id: string;
  label: string;
  trigger: string;
  toFrameId: string;
  /** 遷移先の画面が無くなっていれば null。 */
  toFrameName: string | null;
}

export interface SceneElementRole {
  elementId: string;
  label: string;
  kind: DesignCanvasDocument['elements'][number]['kind'];
  /** 対応するノード・定義 (dynamic.source)。 */
  node: string | null;
  /** 動的に変わる要素なら更新・消滅条件 (未記入は null)。 動的でなければ null。 */
  dynamic: { updateCondition: string | null } | null;
  follow: { targetElementId: string; targetLabel: string | null; condition: string } | null;
  transitions: SceneRoleTransition[];
  /** 表示名以外に役割の記述が 1 つでもあるか。 未記入の要素を見分けるのに使う。 */
  described: boolean;
}

export interface SceneFrameRole {
  frameId: string;
  name: string;
  description: string;
  stateNames: string[];
  /** 画面全体から出る遷移 (要素を起点にしないもの)。 */
  transitions: SceneRoleTransition[];
  elements: SceneElementRole[];
}

export function sceneRoles(canvas: RoleCanvas): SceneFrameRole[] {
  const frameNames = new Map(canvas.frames.map(frame => [frame.id, frame.name]));
  const elementLabels = new Map(canvas.elements.map(element => [element.id, element.label]));
  const toRoleTransition = (transition: RoleCanvas['transitions'][number]): SceneRoleTransition => ({
    id: transition.id,
    label: transition.label,
    trigger: transition.trigger,
    toFrameId: transition.to_frame_id,
    toFrameName: frameNames.get(transition.to_frame_id) ?? null,
  });
  return canvas.frames.map(frame => ({
    frameId: frame.id,
    name: frame.name,
    description: frame.description,
    stateNames: (frame.states ?? []).map(state => state.name),
    transitions: canvas.transitions
      .filter(transition => transition.from.frame_id === frame.id && !transition.from.element_id)
      .map(toRoleTransition),
    elements: canvas.elements.filter(element => element.frame_id === frame.id).map(element => {
      const transitions = canvas.transitions.filter(transition => transition.from.element_id === element.id).map(toRoleTransition);
      const node = element.dynamic?.source ?? null;
      const dynamic = element.dynamic?.enabled ? { updateCondition: element.dynamic.update_condition ?? null } : null;
      const follow = element.follow ? {
        targetElementId: element.follow.target_element_id,
        targetLabel: elementLabels.get(element.follow.target_element_id) ?? null,
        condition: element.follow.condition,
      } : null;
      return {
        elementId: element.id, label: element.label, kind: element.kind, node, dynamic, follow, transitions,
        described: Boolean(node || dynamic || follow || transitions.length > 0),
      };
    }),
  }));
}
