export type AnalysisStageStatus = "passed" | "partial" | "blocked" | "pending";
export type AnalysisRouteStatus = "observed" | "unresolved" | "deferred";

export interface AnalysisStage { label: string; status: AnalysisStageStatus; timestamp: string; detail: string; }
export interface AnalysisOperation { name: string; route: string; routeStatus: AnalysisRouteStatus; checks: string[]; contract: string; }
export interface AnalysisMetric { label: string; value: number; display: string; tone: "blue" | "slate" | "violet" | "amber"; }

/** Sanitized, read-only projection of the 2026-08-29 Nav2 target validation. */
export const TARGET_VALIDATION_ANALYSIS = {
  kind: "Nav2 target validation" as const,
  robotId: "nav2-wsl2-hardening",
  runId: null,
  discoveryId: "disc-20260829T023206-4a9523a1",
  sourceLabel: "Target validation bundle · 2026-08-29",
  runStatus: "DISCOVERY COMPLETE",
  title: "Nav2 release withheld pending stable evidence",
  description: "Read-only Discovery observed a ROS graph, but the bounded graph was unstable and Adapt dry-run correctly blocked all candidate operations.",
  gateStatus: "BLOCKED",
  gateLabel: "dry-run",
  releaseStatus: "NOT PUBLISHED",
  releaseLabel: "acceptance pack",
  runDuration: "—",
  eventCount: 2,
  eligibleOperationCount: 0,
  routeReviewFlags: "9 / 9",
  contextBars: [
    { label: "Bounded ROS samples", value: 2, display: "2 samples", tone: "amber" },
    { label: "ROS nodes", value: 17, display: "17 observed", tone: "blue" },
    { label: "ROS topics", value: 30, display: "30 observed", tone: "violet" },
    { label: "ROS actions", value: 12, display: "12 observed", tone: "slate" },
  ] satisfies AnalysisMetric[],
  evidenceNote: "Graph stability: false · /tf provider included a parallel verification fixture · no operation was invoked.",
  operations: [
    ["app.event.inspect", "HEURISTIC_MAPPING_AMBIGUOUS"], ["app.event.list", "HEURISTIC_MAPPING_AMBIGUOUS"],
    ["app.lidar.snapshot", "TARGET_ROUTE_NOT_OBSERVED"], ["app.localization.pose", "TARGET_ROUTE_NOT_OBSERVED"],
    ["app.manipulation.plan", "HEURISTIC_MAPPING_AMBIGUOUS"], ["app.navigation.costmap.inspect", "HEURISTIC_MAPPING_AMBIGUOUS"],
    ["app.navigation.plan", "HEURISTIC_MAPPING_AMBIGUOUS"], ["app.odometry.sample", "TARGET_ROUTE_NOT_OBSERVED"],
    ["app.regression.plan", "HEURISTIC_MAPPING_AMBIGUOUS"],
  ].map(([name, reason]) => ({
    name, route: "no verified target route", routeStatus: "deferred" as const,
    checks: ["candidate only", reason === "HEURISTIC_MAPPING_AMBIGUOUS" ? "semantic mapping ambiguous" : "runtime route not observed"],
    contract: reason,
  })) satisfies AnalysisOperation[],
  graphNodes: [
    { label: "robot", state: "identity bound", tone: "green" },
    { label: "ROS graph", state: "17 nodes · unstable samples", tone: "amber" },
    { label: "candidate routes", state: "9 deferred · fail closed", tone: "amber" },
    { label: "release", state: "no verified handoff", tone: "slate" },
  ],
  stages: [
    { label: "Target evidence", status: "partial", timestamp: "02:31:36Z", detail: "VERIFIED / READ_ONLY · 17 nodes · 30 topics · 12 actions" },
    { label: "Discovery", status: "partial", timestamp: "02:39:03Z", detail: "PARTIAL · graph stability=false · heuristic candidates remain advisory" },
    { label: "Adapt dry-run", status: "blocked", timestamp: "02:39:03Z", detail: "BLOCKED · 9 candidates deferred; 0 eligible operations" },
    { label: "Promotion", status: "pending", timestamp: "—", detail: "Not started · verified CLI and State Graph handoff required" },
  ] satisfies AnalysisStage[],
  findings: [
    { tone: "green", title: "Read-only boundary held", body: "No motion operation, executor command, process restart, configuration write, or Nav2 invoke was performed." },
    { tone: "amber", title: "ROS evidence is unstable", body: "Two bounded samples disagreed and included a parallel fixture; this evidence must not become a stable target baseline." },
    { tone: "blue", title: "Promotion is correctly blocked", body: "Ambiguous semantics, missing route evidence, and the absent canonical handoff remain explicit instead of being promoted." },
  ],
  hashes: [["discovery manifest", "a094f959…49338289"], ["acceptance pack", "e1f79a50…5d1907b"], ["target evidence", "9e606db0…98ba4e27"]],
} as const;
