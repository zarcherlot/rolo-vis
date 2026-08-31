import assert from "node:assert/strict";

import { RoloClient, RoloApiError, ROLO_API_FEATURES } from "../src/roloClient.ts";
import { liveAuthConfig } from "./liveAuth.mjs";

const baseUrl = (process.env.ROLO_BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const requestedJobId = process.env.ROLO_JOB_ID || "";
const pageLimit = Math.min(Math.max(Number(process.env.ROLO_JOB_PAGE_LIMIT || 25), 1), 100);
const client = new RoloClient(baseUrl, liveAuthConfig());

const health = await client.health();
assert.ok(health.api_features.includes(ROLO_API_FEATURES.jobReadModel), "rolo does not advertise workbench.job-read-model/v1");

const firstPage = await client.jobs(undefined, { limit: pageLimit, offset: 0 });
assert.ok(firstPage.items.length <= firstPage.limit, "job page exceeded its declared limit");
assert.ok(firstPage.total >= firstPage.items.length, "job page total is smaller than its item count");
assert.equal(firstPage.offset, 0);
if (firstPage.next_offset !== null) assert.ok(firstPage.next_offset > firstPage.offset, "job pagination did not advance");

const selected = requestedJobId
  ? firstPage.items.find((item) => item.job_id === requestedJobId) || { job_id: requestedJobId }
  : firstPage.items[0];
let detail = null;
let events = null;
let recoveryStatus = null;
if (selected) {
  detail = await client.job(selected.job_id);
  assert.equal(detail.job.job_id, selected.job_id, "job detail identity drifted from the collection");
  assert.equal(detail.latest_event === null || detail.latest_event.job_id === selected.job_id, true);
  assert.equal(detail.latest_checkpoint === null || detail.latest_checkpoint.job_id === selected.job_id, true);
  assert.equal(detail.limitations.some((item) => /secret|password|token|private.?key|raw path/i.test(item)), false);

  events = await client.jobEvents(selected.job_id, undefined, { limit: pageLimit, offset: 0 });
  assert.equal(events.job_id, selected.job_id, "event page identity drifted from the selected job");
  assert.ok(events.items.length <= events.limit, "event page exceeded its declared limit");
  const eventIds = new Set();
  let previousSequence = -1;
  for (const event of events.items) {
    assert.equal(event.job_id, selected.job_id, "event belongs to another job");
    assert.equal(eventIds.has(event.event_id), false, "event page contains duplicate event IDs");
    eventIds.add(event.event_id);
    assert.ok(event.sequence >= previousSequence, "event sequence regressed");
    previousSequence = event.sequence;
    const encoded = JSON.stringify(event.payload);
    assert.equal(/private.?key|password|authorization|bearer |ssh |raw.?path|command.?args/i.test(encoded), false, "event payload contains unsafe fields");
  }
  if (events.next_offset !== null) assert.ok(events.next_offset > events.offset, "event pagination did not advance");
  recoveryStatus = detail.resumable ? "AVAILABLE" : "NOT_RESUMABLE";
}

let invalidJobStatus = null;
try {
  await client.job("job_missing_for_rolo_vis_live_gate");
} catch (error) {
  if (!(error instanceof RoloApiError)) throw error;
  invalidJobStatus = error.status;
}

console.log(JSON.stringify({
  status: "passed",
  source: baseUrl,
  rolo_version: health.version,
  feature: ROLO_API_FEATURES.jobReadModel,
  jobs: { total: firstPage.total, items: firstPage.items.length, next_offset: firstPage.next_offset },
  selected_job_id: selected?.job_id || null,
  events: events ? { items: events.items.length, next_offset: events.next_offset } : null,
  recovery: recoveryStatus,
  invalid_job_status: invalidJobStatus,
  reads_only: true,
  unsafe_fields_exposed: false,
  auth_mode: client.authMode,
  required_scope: "jobs:read",
}, null, 2));
