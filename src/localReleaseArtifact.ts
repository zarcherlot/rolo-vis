export interface LocalReleaseArtifact {
  releaseId: string;
  robotId: string;
  discoveryId: string;
  sourceRoot: string;
  capturedAt: string;
  run: {
    status: "SUCCEEDED";
    startedAt: string;
    completedAt: string;
    durationS: number;
    eventCount: number;
    provider: string;
    sandbox: string;
  };
  summary: {
    status: "COMPLETE";
    agentRunRef: string;
    snapshotRef: string;
    gateRef: string;
    handoffRef: string;
  };
  gate: {
    status: "PASSED";
    checkedAt: string;
    checks: string[];
    error: string | null;
  };
  handoff: {
    status: "VERIFIED";
    promotedAt: string;
    releaseRef: string;
    releaseManifestSha256: string;
    gateReportSha256: string;
    stateGraphSha256: string;
    conformanceReportSha256: string;
  };
  slice: {
    mode: "SHADOW";
    selected: false;
    outcome: "SHADOW_ONLY";
    authoritativeOperations: string[];
    requestedContextOperations: string[];
    effectiveContextOperations: string[];
    alerts: Array<{ severity: "BLOCKING"; code: string; message: string }>;
    influencesRelease: false;
  };
  context: {
    sliceOperationCount: number;
    agentNativeOperationCount: number;
    agentNativeToolCount: number;
    targetAdapterOperationCount: number;
    injectedTargetAdapterOperationCount: number;
    preparedOperationDetailCount: number;
    shadowTargetAdapterNotInEligibleCount: number;
  };
  nativeTools: {
    mode: "off";
    selected: false;
    status: "NOT_SELECTED";
    callCount: number;
    toolCount: number;
    influencesRelease: false;
  };
  artifacts: Array<{
    name: string;
    kind: "run" | "summary" | "gate" | "handoff" | "snapshot" | "slice";
    reference: string;
    digest?: string;
  }>;
  analysis: {
    headline: string;
    summary: string;
    completedTasks: string[];
    validations: string[];
    blockers: string[];
    handoffReady: boolean;
  };
}

/**
 * Sanitized read-only projection of the local Adapt artifact bundle.
 * The source files remain under the user's local Rolo data directory; this
 * projection deliberately excludes prompt text, event payloads, and package bytes.
 */
export const LOCAL_ADAPT_RELEASE: LocalReleaseArtifact = {
  releaseId: "20260901T094359Z-539510cc",
  robotId: "mentorpi",
  discoveryId: "disc-20260901T093720-76586080",
  sourceRoot: "C:\\Users\\zarch\\AppData\\Local\\rolo\\data\\artifacts",
  capturedAt: "2026-09-01T09:54:58.653408Z",
  run: {
    status: "SUCCEEDED",
    startedAt: "2026-09-01T09:43:59.611909Z",
    completedAt: "2026-09-01T09:54:50.055341Z",
    durationS: 650.443432,
    eventCount: 60,
    provider: "codex",
    sandbox: "workspace-write",
  },
  summary: {
    status: "COMPLETE",
    agentRunRef: "artifact://adapt/mentorpi/runs/20260901T094359Z-539510cc/run.json",
    snapshotRef: "artifact://adapt/mentorpi/runs/20260901T094359Z-539510cc/output-snapshot/snapshot.json",
    gateRef: "artifact://adapt/mentorpi/runs/20260901T094359Z-539510cc/gate.json",
    handoffRef: "artifact://adapt/mentorpi/runs/20260901T094359Z-539510cc/handoff.json",
  },
  gate: {
    status: "PASSED",
    checkedAt: "2026-09-01T09:54:58.387118Z",
    checks: [
      "frozen output hashes and schemas",
      "adapter target paths are resolved portably",
      "robot and discovery identity",
      "Rolo-owned State Graph identity, binding, and route coverage",
      "adapter package describe, entrypoint binding, CLI help, and target CLI sandbox visibility",
      "Adapter Agent bundle-candidate coverage",
      "Rolo-owned builtin operation contracts",
      "product-owned operation contracts",
      "Adapter Agent bundle local-static declarations (advisory)",
      "target route existence without outcome execution",
      "immutable discovery manifest",
      "gate-owned Active Tool Catalog composition",
    ],
    error: null,
  },
  handoff: {
    status: "VERIFIED",
    promotedAt: "2026-09-01T09:54:58.653408Z",
    releaseRef: "output://robots/mentorpi/releases/20260901T094359Z-539510cc/manifest.json",
    releaseManifestSha256: "8474a07c22476c11244b289f7982912ed68150cbd9081fa9b99f9cfa92673e38",
    gateReportSha256: "fdd532eb62f94f9440ea2f783e205fd3805ae6eefe29eedae8bd4792e874e2f2",
    stateGraphSha256: "13395ea35a8fdeb0634d5d494f1885aa9c0c400d9505e78a844b156233e29338",
    conformanceReportSha256: "fd1bf7a58f519f7665e9a88b7e252f7e95096ad5e7e9bf72647319d7cec4ac9a",
  },
  slice: {
    mode: "SHADOW",
    selected: false,
    outcome: "SHADOW_ONLY",
    authoritativeOperations: ["app.camera.snapshot"],
    requestedContextOperations: [
      "app.camera.calibration.status",
      "app.camera.inspect",
      "app.camera.list",
      "app.camera.snapshot",
      "app.lidar.snapshot",
      "app.localization.pose",
      "app.odometry.sample",
      "app.robot.discover",
      "app.robot.health",
      "app.robot.status",
      "app.state.watch",
      "app.teleop.velocity",
    ],
    effectiveContextOperations: ["app.camera.snapshot"],
    alerts: [{
      severity: "BLOCKING",
      code: "SLICE_OUTSIDE_ELIGIBILITY",
      message: "Slice cannot expand beyond authoritative eligibility",
    }],
    influencesRelease: false,
  },
  context: {
    sliceOperationCount: 12,
    agentNativeOperationCount: 0,
    agentNativeToolCount: 22,
    targetAdapterOperationCount: 12,
    injectedTargetAdapterOperationCount: 1,
    preparedOperationDetailCount: 12,
    shadowTargetAdapterNotInEligibleCount: 11,
  },
  nativeTools: {
    mode: "off",
    selected: false,
    status: "NOT_SELECTED",
    callCount: 0,
    toolCount: 22,
    influencesRelease: false,
  },
  artifacts: [
    { name: "run.json", kind: "run", reference: "artifact://adapt/mentorpi/runs/20260901T094359Z-539510cc/run.json" },
    { name: "summary.json", kind: "summary", reference: "artifact://adapt/mentorpi/runs/20260901T094359Z-539510cc/summary.json" },
    { name: "gate.json", kind: "gate", reference: "artifact://adapt/mentorpi/runs/20260901T094359Z-539510cc/gate.json", digest: "fdd532eb62f94f9440ea2f783e205fd3805ae6eefe29eedae8bd4792e874e2f2" },
    { name: "handoff.json", kind: "handoff", reference: "artifact://adapt/mentorpi/runs/20260901T094359Z-539510cc/handoff.json" },
    { name: "snapshot.json", kind: "snapshot", reference: "artifact://adapt/mentorpi/runs/20260901T094359Z-539510cc/output-snapshot/snapshot.json", digest: "13395ea35a8fdeb0634d5d494f1885aa9c0c400d9505e78a844b156233e29338" },
    { name: "slice-activation-decision.json", kind: "slice", reference: "artifact://adapt/mentorpi/runs/20260901T094359Z-539510cc/slice-activation-decision.json", digest: "696fe156072cf9192ba21ec0847a4daf02a967d176f56d0da54a7a825ed5c903" },
  ],
  analysis: {
    headline: "Adapt handoff is complete; the selected slice remains shadow-only",
    summary: "Implemented and locally validated the MentorPi app.camera.snapshot adapter bundle. Handoff pack succeeded on the first attempt.",
    completedTasks: [
      "Retrieved the authoritative current-task operation set: app.camera.snapshot only",
      "Implemented the standalone adapter bundle with strict describe/invoke ABI",
      "Created the AdapterBundleManifest, State Graph proposal, and conformance report",
      "Ran focused ABI, error, fake-route, and syntax checks",
      "Ran Adapt handoff pack successfully",
    ],
    validations: [
      "describe emitted the exact one-operation mapping",
      "Unknown operation and mismatched entrypoint rejected with a bounded JSON error",
      "Fake selected-route invoke returned bounded metadata without image payload",
      "adapter.py SHA-256 matches the manifest package hash",
      "adapt handoff pack succeeded and advisory describe validation passed",
    ],
    blockers: [],
    handoffReady: true,
  },
};
