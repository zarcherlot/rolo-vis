import type { PipelineRow } from "./demoData";
import type { LifecycleRunSummary } from "./types/rolo";

export interface LifecycleAssessmentRow {
  stage: string;
  status: string;
  optional: boolean;
  blockers: number;
  prerequisites: number;
  artifacts: number;
  owner: string;
  supportedRuns: number;
  observedAt: string | null;
}

export interface LifecycleAssessmentSummary {
  stages: number;
  blocked: number;
  degraded: number;
  readyOrComplete: number;
  blockers: number;
  supportedRuns: number;
  rows: LifecycleAssessmentRow[];
}

const STAGE_ORDER = ["adapt", "diagnose", "verify"];

export function summarizeLifecycleAssessment(
  pipeline: PipelineRow[],
  runs: LifecycleRunSummary[],
): LifecycleAssessmentSummary {
  const rows = pipeline
    .map((stage) => ({
      stage: stage.stage,
      status: stage.status,
      optional: Boolean(stage.optional),
      blockers: stage.blockerMessages?.length ?? stage.blockers,
      prerequisites: stage.prerequisites?.length || 0,
      artifacts: stage.artifactRefs?.length ?? stage.artifacts,
      owner: stage.agentRequirement || "unassigned",
      supportedRuns: runs.filter((run) => run.stage === stage.stage).length,
      observedAt: stage.observedAt || null,
    }))
    .sort((left, right) => {
      const leftIndex = STAGE_ORDER.indexOf(left.stage);
      const rightIndex = STAGE_ORDER.indexOf(right.stage);
      return (leftIndex < 0 ? STAGE_ORDER.length : leftIndex) - (rightIndex < 0 ? STAGE_ORDER.length : rightIndex);
    });

  return {
    stages: rows.length,
    blocked: rows.filter((row) => row.status === "BLOCKED").length,
    degraded: rows.filter((row) => row.status === "DEGRADED").length,
    readyOrComplete: rows.filter((row) => row.status === "READY" || row.status === "COMPLETE").length,
    blockers: rows.reduce((count, row) => count + row.blockers, 0),
    supportedRuns: rows.reduce((count, row) => count + row.supportedRuns, 0),
    rows,
  };
}
