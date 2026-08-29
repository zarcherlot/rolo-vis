import assert from "node:assert/strict";
import test from "node:test";
import { TARGET_VALIDATION_ANALYSIS } from "../src/lerobotAnalysisData.ts";

test("target validation projection matches the latest Nav2 evidence", () => {
  assert.equal(TARGET_VALIDATION_ANALYSIS.robotId, "nav2-wsl2-hardening");
  assert.equal(TARGET_VALIDATION_ANALYSIS.discoveryId, "disc-20260829T023206-4a9523a1");
  assert.equal(TARGET_VALIDATION_ANALYSIS.gateStatus, "BLOCKED");
  assert.equal(TARGET_VALIDATION_ANALYSIS.releaseStatus, "NOT PUBLISHED");
  assert.equal(TARGET_VALIDATION_ANALYSIS.eligibleOperationCount, 0);
  assert.equal(TARGET_VALIDATION_ANALYSIS.operations.length, 9);
  assert.ok(TARGET_VALIDATION_ANALYSIS.operations.every((operation) => operation.routeStatus === "deferred"));
  assert.ok(TARGET_VALIDATION_ANALYSIS.stages.some((stage) => stage.status === "blocked"));
});

test("target validation projection does not expose raw target paths or credentials", () => {
  const serialized = JSON.stringify(TARGET_VALIDATION_ANALYSIS);
  assert.doesNotMatch(serialized, /(?:^|["' ])\/(?:home|root|etc|tmp)\//i);
  assert.doesNotMatch(serialized, /(?:password|private[_-]?key|known[_-]?hosts|api[_-]?key|ssh\s+-)/i);
});
