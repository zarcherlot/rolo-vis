import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, sep } from "node:path";

const sourceDataRoot = process.env.ROLO_SOURCE_DATA_ROOT;
const episodeProjectionFixture = process.env.ROLO_EPISODE_PROJECTION_FIXTURE;
const observationRecordFixture = process.env.ROLO_OBSERVATION_RECORD_FIXTURE;
const validationDataRoot = process.env.ROLO_VALIDATION_DATA_ROOT;
const robotId = process.env.ROLO_ROBOT_ID || "mentorpi";
const episodeId = process.env.ROLO_EPISODE_ID || "ep-e22-observation";

if (!sourceDataRoot || !episodeProjectionFixture || !observationRecordFixture || !validationDataRoot) {
  throw new Error("ROLO_SOURCE_DATA_ROOT, ROLO_EPISODE_PROJECTION_FIXTURE, ROLO_OBSERVATION_RECORD_FIXTURE, and ROLO_VALIDATION_DATA_ROOT are required.");
}

const sourceRoot = resolve(sourceDataRoot);
const episodeFixturePath = resolve(episodeProjectionFixture);
const observationFixturePath = resolve(observationRecordFixture);
const targetRoot = resolve(validationDataRoot);
if (![sourceRoot, episodeFixturePath, observationFixturePath].every(existsSync)) {
  throw new Error("The source rolo-data root or one of the reviewed E22 fixtures does not exist.");
}
if (targetRoot === sourceRoot || targetRoot.startsWith(`${sourceRoot}${sep}`)) {
  throw new Error("The isolated E22 validation root must be outside the source rolo-data root.");
}
if (existsSync(targetRoot)) throw new Error("The isolated E22 validation root already exists; refusing to overwrite it.");

await cp(sourceRoot, targetRoot, { recursive: true, errorOnExist: true, force: false });
await mkdir(resolve(targetRoot, "output"), { recursive: true });

const episode = JSON.parse(await readFile(episodeFixturePath, "utf8"));
episode.detail.robot_id = robotId;
episode.detail.episode_id = episodeId;
episode.detail.revision = 1;
episode.detail.task_label = "Episode Observation Bundle validation";
episode.detail.execution_id = `exec-${episodeId}`;
episode.detail.lifecycle_run_id = `run-${episodeId}`;
episode.detail.source_kind = "published_episode_projection";
episode.detail.limitations = [...new Set([
  ...(episode.detail.limitations || []),
  "This immutable publication is isolated E22 live-gate data derived from reviewed fixtures.",
])];
for (const event of episode.timeline) {
  event.robot_id = robotId;
  event.episode_id = episodeId;
  event.revision = 1;
}

const episodePublicationRoot = resolve(targetRoot, "artifacts", "episodes", robotId, "published");
await mkdir(episodePublicationRoot, { recursive: true });
await writeFile(
  resolve(episodePublicationRoot, `${episodeId}.json`),
  `${JSON.stringify(episode, null, 2)}\n`,
  { encoding: "utf8", flag: "wx" },
);

const record = JSON.parse(await readFile(observationFixturePath, "utf8"));
const sourceProjection = (bundle, source) => ({
  schema_version: "rolo-episode-observation-source-coverage/v1",
  robot_id: robotId,
  episode_id: episodeId,
  episode_revision: 1,
  bundle_id: bundle.bundle_id,
  source_id: source.source_id,
  label: source.public_label,
  source_kind: source.source_kind,
  modality: source.modality,
  world_kind: source.world_kind,
  availability: source.availability,
  synchronization: source.synchronization,
  spatial_alignment: source.spatial_alignment,
  asset_ids: source.asset_ids,
  limitations: source.public_limitations,
});
const bundleProjection = (bundle) => {
  const sources = bundle.sources.map((source) => sourceProjection(bundle, source));
  const assetIds = [...new Set(sources.flatMap((source) => source.asset_ids))];
  const worldKinds = new Set(sources.filter((source) => source.asset_ids.length > 0).map((source) => source.world_kind));
  const worldScope = worldKinds.size === 0
    ? "NONE"
    : worldKinds.size > 1
      ? "MIXED"
      : `${[...worldKinds][0]}_ONLY`;
  return {
    schema_version: "rolo-episode-observation-bundle-summary/v1",
    robot_id: robotId,
    episode_id: episodeId,
    episode_revision: 1,
    bundle_id: bundle.bundle_id,
    sequence: bundle.sequence,
    parent_bundle_id: bundle.parent_bundle_id,
    trigger_kind: bundle.trigger_kind,
    status: bundle.status,
    created_at: bundle.created_at,
    window_start_offset_ms: bundle.window_start_offset_ms,
    window_end_offset_ms: bundle.window_end_offset_ms,
    synchronization: bundle.synchronization,
    spatial_alignment: bundle.spatial_alignment,
    world_scope: worldScope,
    sources,
    asset_ids: assetIds,
    evidence_ids: bundle.sequence === 1 ? [episode.detail.evidence_ids[0]] : [],
    limitations: bundle.public_limitations,
    influences_verification: false,
  };
};
const observationProjection = {
  schema_version: "rolo-episode-observation-bundle-published-projection/v1",
  robot_id: robotId,
  episode_id: episodeId,
  episode_revision: 1,
  as_of: record.committed_at,
  immutable: true,
  items: record.bundles.map(bundleProjection).sort((left, right) => right.sequence - left.sequence),
  limitations: record.public_limitations,
};

const observationPublicationRoot = resolve(targetRoot, "artifacts", "episodes", robotId, "published-observations", episodeId);
await mkdir(observationPublicationRoot, { recursive: true });
await writeFile(
  resolve(observationPublicationRoot, "revision-1.json"),
  `${JSON.stringify(observationProjection, null, 2)}\n`,
  { encoding: "utf8", flag: "wx" },
);

console.log(JSON.stringify({
  status: "prepared",
  source_data_root: sourceRoot,
  validation_data_root: targetRoot,
  config_dir: resolve(targetRoot, "config"),
  artifact_dir: resolve(targetRoot, "artifacts"),
  output_dir: resolve(targetRoot, "output"),
  robot_id: robotId,
  episode_id: episodeId,
  revision: 1,
  bundle_count: observationProjection.items.length,
  source_preserved: true,
  public_projection_contains_internal_fixture_fields: false,
}, null, 2));
