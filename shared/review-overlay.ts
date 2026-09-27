import type { DesignCanvasDocument } from './design-canvas.ts';
import type { ScenarioExperience } from './scenario-experience.ts';

export interface OverlaySpec { id: string; code: string; title: string; description: string | null; status: string; version: number }
export interface OverlayEvidence { targetKind: string; targetId: string; kind: string; status: string; sourceRef: string; sourceRevision: string; isStale: boolean }
export interface OverlayImplementation {
  state: 'available' | 'unavailable'; message: string;
  items: OverlayImplementationReview[];
}
export interface OverlayImplementationReview {
  kind: 'spec' | 'scenario'; id: string; title: string; specificationRevision: string;
  state: 'unregistered' | 'in_progress' | 'returned' | 'specification_changed' | 'awaiting_confirmation' | 'completed';
  tasks: { id: string; title: string; status: string; isBacklog: boolean }[];
  confirmation: { actorId: string; confirmedAt: string; note: string } | null;
}
export interface OverlayScenario extends ScenarioExperience {
  id: string; name: string; goal: string; successOutcome: string; revision: number;
  canvas: DesignCanvasDocument; evidence: OverlayEvidence[];
}
export interface ReviewOverlaySnapshot {
  projectId: string;
  teamId: string;
  projectName: string;
  implementation: OverlayImplementation;
  scene: { id: string; name: string; canvas: DesignCanvasDocument } | null;
  specs: OverlaySpec[];
  scenarios: OverlayScenario[];
  acceptance: {
    specVersion: string;
    latestRun: { id: string; status: string; startedAt: string; version: string | null } | null;
    results: { total: number; passed: number; failed: number; blocked: number; pending: number };
  };
}
