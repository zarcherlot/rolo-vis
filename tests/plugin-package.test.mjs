import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { promisify } from "node:util";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const packageName = `rolo-vis-${packageJson.version}`;
const stageRoot = path.join(root, "dist", "plugin", packageName);
const archivePath = path.join(root, "dist", `${packageName}.zip`);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const execFileAsync = promisify(execFile);

test("E23C emits a complete deterministic v2 device package", async () => {
  const [manifest, checksums, archive, archiveDigest] = await Promise.all([
    readFile(path.join(stageRoot, "rolo.plugin.json"), "utf8").then(JSON.parse),
    readFile(path.join(stageRoot, "SHA256SUMS"), "utf8"),
    readFile(archivePath),
    readFile(`${archivePath}.sha256`, "utf8"),
  ]);
  assert.equal(manifest.schema_version, "rolo-plugin/v2");
  assert.deepEqual(manifest.delivery, {
    mode: "device-local",
    mount_path: "/workbench/",
    spa_fallback: "scoped",
  });
  assert.equal(manifest.api.base_path, "/rolo-api");
  assert.deepEqual(manifest.api.required_features, []);
  assert.deepEqual(manifest.integrity, { algorithm: "sha256", manifest: "SHA256SUMS" });

  const entries = checksums.trimEnd().split("\n").map((line) => {
    const match = /^([0-9a-f]{64})  (.+)$/.exec(line);
    assert.ok(match, `invalid checksum line: ${line}`);
    return { digest: match[1], relative: match[2] };
  });
  assert.ok(entries.some((entry) => entry.relative === "rolo.plugin.json"));
  assert.ok(entries.some((entry) => entry.relative === "dist/client/index.html"));
  for (const entry of entries) {
    const value = await readFile(path.join(stageRoot, ...entry.relative.split("/")));
    assert.equal(sha256(value), entry.digest);
  }
  assert.equal(archive.readUInt32LE(0), 0x04034b50);
  assert.match(archive.toString("utf8"), new RegExp(`${packageName}/dist/client/index\\.html`));
  assert.equal(archiveDigest, `${sha256(archive)}  ${path.basename(archivePath)}\n`);

  await execFileAsync(process.execPath, [path.join(root, "scripts", "package-plugin.mjs")], {
    cwd: root,
  });
  const rebuilt = await readFile(archivePath);
  assert.equal(sha256(rebuilt), sha256(archive));
});

test("E23C leaves no active Sites source or packaged runtime", async () => {
  const retired = [
    ".openai/hosting.json",
    "worker/index.js",
    "scripts/prepare-sites-build.mjs",
    "tests/sites-worker.test.mjs",
    "dist/server",
    "dist/.openai",
  ];
  for (const relative of retired) {
    await assert.rejects(access(path.join(root, ...relative.split("/"))));
  }
  assert.deepEqual((await readdir(path.join(root, "dist", "plugin"))).sort(), [packageName]);
});
