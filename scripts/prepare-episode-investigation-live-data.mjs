import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const sourceDataRoot = process.env.ROLO_SOURCE_DATA_ROOT;
const projectionFixture = process.env.ROLO_EPISODE_PROJECTION_FIXTURE;
const validationDataRoot = process.env.ROLO_VALIDATION_DATA_ROOT;
const robotId = process.env.ROLO_ROBOT_ID || "mentorpi";

if (!sourceDataRoot || !projectionFixture || !validationDataRoot) {
  throw new Error("ROLO_SOURCE_DATA_ROOT, ROLO_EPISODE_PROJECTION_FIXTURE, and ROLO_VALIDATION_DATA_ROOT are required.");
}

const sourceRoot = resolve(sourceDataRoot);
const fixturePath = resolve(projectionFixture);
const targetRoot = resolve(validationDataRoot);
if (!existsSync(sourceRoot) || !existsSync(fixturePath)) {
  throw new Error("The source rolo-data root or Episode projection fixture does not exist.");
}
if (existsSync(targetRoot)) {
  throw new Error("The isolated validation root already exists; refusing to overwrite it.");
}

await cp(sourceRoot, targetRoot, { recursive: true, errorOnExist: true, force: false });
const template = JSON.parse(await readFile(fixturePath, "utf8"));
const publications = [
  { episodeId: "ep-e9-reference", startedAt: "2026-08-24T12:00:00Z", taskLabel: "Reference inspection run" },
  { episodeId: "ep-e9-member-newest", startedAt: "2026-08-23T12:00:00Z", taskLabel: "Newest exact-match member" },
  { episodeId: "ep-e9-member-prior", startedAt: "2026-08-19T12:00:00Z", taskLabel: "Prior exact-match member" },
];
const publicationRoot = resolve(targetRoot, "artifacts", "episodes", robotId, "published");
await mkdir(publicationRoot, { recursive: true });

for (const publication of publications) {
  const payload = structuredClone(template);
  const startedAt = new Date(publication.startedAt);
  const endedAt = new Date(startedAt.getTime() + 4_000);
  payload.detail.robot_id = robotId;
  payload.detail.episode_id = publication.episodeId;
  payload.detail.task_label = publication.taskLabel;
  payload.detail.started_at = startedAt.toISOString();
  payload.detail.ended_at = endedAt.toISOString();
  payload.detail.as_of = new Date(endedAt.getTime() + 1_000).toISOString();
  payload.detail.execution_id = `exec-${publication.episodeId}`;
  payload.detail.lifecycle_run_id = `run-${publication.episodeId}`;
  for (const event of payload.timeline) {
    event.robot_id = robotId;
    event.episode_id = publication.episodeId;
    event.occurred_at = new Date(startedAt.getTime() + event.offset_ms).toISOString();
  }
  await writeFile(
    resolve(publicationRoot, `${publication.episodeId}.json`),
    `${JSON.stringify(payload, null, 2)}\n`,
    { encoding: "utf8", flag: "wx" },
  );
}

console.log(JSON.stringify({
  status: "prepared",
  source_data_root: sourceRoot,
  validation_data_root: targetRoot,
  config_dir: resolve(targetRoot, "config"),
  artifact_dir: resolve(targetRoot, "artifacts"),
  output_dir: resolve(targetRoot, "output"),
  robot_id: robotId,
  episode_ids: publications.map((item) => item.episodeId),
  source_preserved: true,
}, null, 2));

