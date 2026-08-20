export type ConnectionMode = "live" | "partial";

export interface HealthResponse {
  status: "HEALTHY" | "DEGRADED" | "UNHEALTHY";
  service: string;
  version: string;
  robots: number;
  robot_use_backend: string;
  openai_key_configured: boolean;
  timestamp: string;
}

export interface RobotCapability {
  schema_version: string;
  robot_id: string;
  adapter: string;
  platform: Record<string, unknown>;
  geometry: Record<string, unknown>;
  sensors: Record<string, unknown>;
  features: Record<string, unknown>;
}

export type StageStatus = "NOT_STARTED" | "BLOCKED" | "DEGRADED" | "READY" | "COMPLETE";

export interface StageAssessment {
  schema_version: "robot-stage-assessment/v1";
  stage: "adapt" | "diagnose" | "verify";
  robot_id: string;
  status: StageStatus;
  summary: string;
  optional: boolean;
  prerequisites: string[];
  artifacts: Record<string, string>;
  blockers: string[];
  agent_requirement: string;
  observed_at: string;
}

export interface PipelineAssessment {
  schema_version: "robot-three-stage-pipeline/v1";
  robot_id: string;
  stages: StageAssessment[];
  observed_at: string;
}

export interface OverviewBlocker {
  schema_version: "rolo-blocker-summary/v1";
  blocker_id: string;
  stage: string;
  message: string;
  recommended_action: string;
  owner: string;
  observed_at: string;
  freshness: "fresh";
  source_kind: "pipeline_assessment";
  confidence: number;
  integrity_status: "validated";
  evidence_refs: string[];
}

export interface RobotOverview {
  schema_version: "rolo-robot-overview/v1";
  robot_id: string;
  state: "READY" | "ATTENTION" | "DEGRADED" | "NOT_READY";
  summary: string;
  next_action: string;
  blockers: OverviewBlocker[];
  pipeline: PipelineAssessment;
  observed_at: string;
  freshness: "fresh";
  source_kind: "computed_read_model";
  confidence: number;
  integrity_status: "validated";
}

export interface BootstrapResult {
  mode: ConnectionMode;
  health: HealthResponse;
  robots: RobotCapability[];
  robot: RobotCapability | null;
  overview: RobotOverview | null;
  pipeline: PipelineAssessment | null;
  issues: string[];
}
