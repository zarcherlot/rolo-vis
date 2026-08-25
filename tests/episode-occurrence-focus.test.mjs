import assert from "node:assert/strict";
import test from "node:test";

import { resolveEpisodeOccurrenceFocus } from "../src/episodeOccurrenceFocus.ts";

const detail = {
  robot_id: "mentorpi",
  episode_id: "ep-left",
  revision: 1,
  findings: [{ finding_id: "finding-1", supporting_evidence_ids: ["ev-support"], contradicting_evidence_ids: ["ev-contradict"] }],
  assets: [{ asset_id: "asset-1", evidence_id: "ev-asset" }],
};
const events = [{ event_id: "event-1", lane: "OUTCOME", evidence_ids: ["ev-event"] }];
const occurrence = (source, role, contextId) => ({ source, role, contextId });

test("E13/E14 resolves only exact left Timeline, Finding, and Asset reference attachments", () => {
  assert.deepEqual(resolveEpisodeOccurrenceFocus("ev-event", occurrence("TIMELINE", "REFERENCE", "event-1"), detail, events), { kind: "EVENT", eventId: "event-1", lane: "OUTCOME" });
  assert.deepEqual(resolveEpisodeOccurrenceFocus("ev-support", occurrence("FINDING_SUPPORTING", "SUPPORTING", "finding-1"), detail, events), { kind: "FINDING", findingId: "finding-1", role: "SUPPORTING" });
  assert.deepEqual(resolveEpisodeOccurrenceFocus("ev-contradict", occurrence("FINDING_CONTRADICTING", "CONTRADICTING", "finding-1"), detail, events), { kind: "FINDING", findingId: "finding-1", role: "CONTRADICTING" });
  assert.deepEqual(resolveEpisodeOccurrenceFocus("ev-asset", occurrence("ASSET", "REFERENCE", "asset-1"), detail, events), { kind: "ASSET", assetId: "asset-1" });
});

test("E13 rejects stale IDs, mismatched roles, and context-only source kinds", () => {
  assert.equal(resolveEpisodeOccurrenceFocus("ev-other", occurrence("TIMELINE", "REFERENCE", "event-1"), detail, events), null);
  assert.equal(resolveEpisodeOccurrenceFocus("ev-support", occurrence("FINDING_SUPPORTING", "CONTRADICTING", "finding-1"), detail, events), null);
  assert.equal(resolveEpisodeOccurrenceFocus("ev-event", occurrence("TIMELINE", "REFERENCE", "missing-event"), detail, events), null);
  assert.equal(resolveEpisodeOccurrenceFocus("ev-support", occurrence("EPISODE", "REFERENCE", "ep-left@1"), detail, events), null);
  assert.equal(resolveEpisodeOccurrenceFocus("ev-other", occurrence("ASSET", "REFERENCE", "asset-1"), detail, events), null);
  assert.equal(resolveEpisodeOccurrenceFocus("ev-asset", occurrence("ASSET", "SUPPORTING", "asset-1"), detail, events), null);
  assert.equal(resolveEpisodeOccurrenceFocus("ev-asset", occurrence("ASSET", "REFERENCE", "missing-asset"), detail, events), null);
});
