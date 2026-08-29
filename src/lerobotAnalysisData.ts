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

/** Sanitized read-only projection of the attached production artifact bundle. */
export const REAL_DEVICE_ARTIFACT_ANALYSIS = {
  kind: "Real-device artifact analysis" as const,
  robotId: "wsl2-post-r5-nav2-sim",
  runId: "20260829T112346Z-f2950d73",
  discoveryId: "disc-20260829T110710-1f0942f9",
  sourceLabel: "Imported production bundle · 2026-08-29",
  runStatus: "ADAPT COMPLETE",
  title: "Adapter package promoted; execution remains shadow-only",
  description: "The attached target bundle was analyzed as read-only evidence. Discovery is partial, the adapter gate passed, and no native tool or motion operation was invoked.",
  gateStatus: "PASSED",
  gateLabel: "adapter gate",
  gateTone: "green" as const,
  releaseStatus: "SHADOW ONLY",
  releaseLabel: "slice not selected · no release effect",
  releaseTone: "amber" as const,
  runDuration: "4m 58s",
  eventCount: 43,
  eligibleOperationCount: 0,
  routeReviewFlags: "5 / 5",
  contextBars: [
    { label: "ROS nodes", value: 19, display: "19 observed", tone: "blue" },
    { label: "ROS topics", value: 38, display: "38 observed", tone: "violet" },
    { label: "ROS actions", value: 12, display: "12 observed", tone: "slate" },
    { label: "ROS services", value: 144, display: "144 observed", tone: "slate" },
  ] satisfies AnalysisMetric[],
  evidenceNote: "Ubuntu 22.04.5 on WSL2 · ROS 2 Humble · domain 50 · rmw_fastrtps_cpp. Discovery stayed PARTIAL with four unresolved motion-geometry semantics; the target is local and read-only.",
  operations: [
    ["app.camera.snapshot", "/image_raw", "sensor_msgs/msg/Image"],
    ["app.lidar.snapshot", "/scan", "sensor_msgs/msg/LaserScan"],
    ["app.localization.status", "/odom", "nav_msgs/msg/Odometry"],
    ["app.map.inspect", "/map + /map_server/transition_event", "nav_msgs/msg/OccupancyGrid"],
    ["app.teleop.velocity", "/cmd_vel", "geometry_msgs/msg/Twist"],
  ].map(([name, route, interfaceType]) => ({
    name,
    route,
    routeStatus: "observed" as const,
    checks: ["runtime route observed", "operation remains DISCOVERED_UNVERIFIED"],
    contract: `DISCOVERED_UNVERIFIED · ${interfaceType}`,
  })) satisfies AnalysisOperation[],
  graphNodes: [
    { label: "target", state: "local target · SSH agent", tone: "green" },
    { label: "discovery", state: "PARTIAL · 19 nodes · 38 topics", tone: "amber" },
    { label: "adapter", state: "stage1 · 5 operations", tone: "blue" },
    { label: "gate", state: "PASSED · immutable refs", tone: "green" },
    { label: "slice", state: "SHADOW_ONLY · no release effect", tone: "amber" },
    { label: "verification", state: "PASS · 2 regression cases", tone: "green" },
  ],
  stages: [
    { label: "Discovery", status: "partial", timestamp: "11:07:10Z", detail: "PARTIAL · 19 nodes · 38 topics · 12 actions · 4 unresolved semantics" },
    { label: "Adapt run", status: "passed", timestamp: "11:28:44Z", detail: "SUCCEEDED · adapter snapshot, State Graph, and conformance artifacts emitted" },
    { label: "Adapter gate", status: "passed", timestamp: "11:28:48Z", detail: "PASSED · identity, frozen hashes, route coverage, contracts, and catalog composition" },
    { label: "Promotion", status: "passed", timestamp: "11:28:48Z", detail: "PROMOTED · release manifest published; selected slice remains SHADOW_ONLY" },
    { label: "Verification", status: "passed", timestamp: "11:29:59Z", detail: "PASS · linux.uname and ros.node.list fields verified; no actuation performed" },
  ] satisfies AnalysisStage[],
  findings: [
    { tone: "green", title: "Artifact chain is internally consistent", body: "Discovery, adapt, diagnosis, promotion, and verification handoffs carry immutable references and matching robot identity." },
    { tone: "amber", title: "Discovery is partial, not a motion baseline", body: "Drive model, footprint, and hard velocity limits remain unresolved; treat candidate semantics as advisory until explicitly validated." },
    { tone: "blue", title: "Adapter coverage is read-only and local-static", body: "Five operation contracts passed schema, error, idempotency, and cancellation checks. Native tool rollout was off and call count was zero." },
  ],
  hashes: [
    ["discovery manifest", "b42ececa…0d8c0648"],
    ["adapter handoff", "6736b96b…3f556d15"],
    ["state graph", "1c7e0922…54d91cf6"],
    ["verification pack", "0f9f8ce8…bba61d92"],
  ],
} as const;
