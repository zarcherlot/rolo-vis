import type { AssociationReport } from "./types/rolo";

const digest = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

export const DEMO_ASSOCIATION: AssociationReport = {
  schema_version: "association-report/v1",
  association_id: "assoc-demo-20260903-001",
  parent_association_id: null,
  robot_id: "AMR-07",
  target_fingerprint: digest,
  snapshot_id: "snapshot-demo-102431",
  evidence_view_digest: digest,
  evidence_delta_digest: null,
  proposals: [
    {
      operation_id: "ros.graph.inspect",
      resource_id: "ros-graph",
      decision: "PROPOSED",
      confidence: 0.92,
      evidence_ids: ["fact-ros-graph-01", "fact-route-17"],
      rationale: "Observed ROS graph route and middleware revision match the read-only inspection contract.",
      missing_evidence: [],
      limitations: ["Route presence is not behavior verification."],
      requires_user_confirmation: true,
    },
    {
      operation_id: "app.navigation.goal.send",
      resource_id: null,
      decision: "UNSUPPORTED",
      confidence: 1,
      evidence_ids: ["fact-readonly-boundary-01"],
      rationale: "This session publishes no write or motion authority.",
      missing_evidence: [],
      limitations: ["Read-only Workbench cannot submit navigation goals."],
      requires_user_confirmation: false,
    },
  ],
  unresolved: ["app.map.inspect"],
  model_ref: "demo/rules-only/v1",
  prompt_digest: digest,
  generated_at: "2026-09-03T08:00:00Z",
  limitations: ["Demo report; replace with a rolo-v2 AssociationReport before operational use."],
};
