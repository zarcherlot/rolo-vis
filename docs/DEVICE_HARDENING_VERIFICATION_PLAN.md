# Device-side hardening verification plan

Status: E26 candidate; no production device evidence attached

This plan is the handoff checklist for validating the robot-hosted workbench against
real targets. It deliberately keeps local build/test results separate from external
device evidence.

## Validation matrix

The machine-readable matrix is `tests/fixtures/device-hardening-matrix.json` and is
checked by `npm run check:device-hardening`.

| Scenario | Current state | Required evidence |
| --- | --- | --- |
| Windows development | Automated checked | clean build, preview, plugin package |
| Linux ARM64 | Pending external | install, health, read-only API, rollback |
| Linux x86_64 | Pending external | install, health, read-only API, rollback |
| Offline install | Pending external | package verification without network |
| Non-root + sudo | Pending external | bounded sudo policy and failure diagnostics |
| SSH jump host | Pending external | host-key and route verification |
| Host-key rotation | Pending external | explicit re-enrollment, no silent trust |
| Network interruption | Pending external | bounded timeout, no duplicate mutation |
| Restart/resume | Pending external | Job recovery state without auto-resume |
| Upgrade/rollback | Pending external | signed package, health failure rollback |
| Enrollment rotation | Pending external | old credential invalidation and rebind |

## Required gates

1. `npm run verify:baseline` passes on the pinned rolo-vis checkout.
2. rolo staging harness passes on the paired rolo checkout, including package and
   release checks.
3. Every external scenario records target OS/architecture, package digest, Job ID,
   Gate result, and sanitized diagnostic summary.
4. A failed or missing scenario stays `PENDING_EXTERNAL` or `BLOCKED`; it cannot be
   represented as `READY` by the UI or release metadata.
5. No evidence includes private keys, raw SSH credentials, workspace paths, artifact
   bytes, or unredacted transport output.

## Execution boundary

rolo remains the robot-owned host and control plane. rolo-vis is a read-only plugin;
this matrix does not add a hosted site, browser-side SSH, bootstrap execution, or
rollback authority. Real-device execution must happen through the controlled rolo
staging/CLI path, then publish only the sanitized evidence needed for review.
