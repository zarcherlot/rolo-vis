#!/usr/bin/env node
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const clientRoot = path.join(dist, "client");
const manifestPath = path.join(root, "rolo.plugin.json");
const packageJsonPath = path.join(root, "package.json");

const maxFiles = 2048;
const maxFileBytes = 16 * 1024 * 1024;
const maxTotalBytes = 256 * 1024 * 1024;
const fixedDosTime = 0;
const fixedDosDate = (1 << 5) | 1;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertSafeRelative(relative) {
  if (
    !relative
    || relative.includes("\\")
    || relative.startsWith("/")
    || relative.split("/").some((part) => !part || part === "." || part === ".." || part.startsWith("."))
    || relative.toLowerCase().endsWith(".map")
  ) {
    throw new Error(`Unsafe plugin package path: ${relative}`);
  }
}

async function collectFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, "en"))) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    assertSafeRelative(relative);
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Plugin package links are forbidden: ${relative}`);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolute, relative));
      continue;
    }
    if (!entry.isFile()) throw new Error(`Unsupported plugin file type: ${relative}`);
    const info = await stat(absolute);
    if (info.size > maxFileBytes) throw new Error(`Plugin file exceeds size budget: ${relative}`);
    files.push({ relative, absolute, size: info.size });
  }
  return files;
}

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  return crc >>> 0;
});

function crc32(value) {
  let crc = 0xffffffff;
  for (const byte of value) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function createDeterministicZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const data = file.data;
    const checksum = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(fixedDosTime, 10);
    local.writeUInt16LE(fixedDosDate, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(fixedDosTime, 12);
    central.writeUInt16LE(fixedDosDate, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

const [packageJson, manifest] = await Promise.all([
  readFile(packageJsonPath, "utf8").then(JSON.parse),
  readFile(manifestPath, "utf8").then(JSON.parse),
]);
if (manifest.schema_version !== "rolo-plugin/v2") throw new Error("Expected rolo-plugin/v2");
if (manifest.version !== packageJson.version) throw new Error("Manifest and package versions differ");
if (manifest.entry !== "dist/client/index.html") throw new Error("Unexpected plugin entry");
if (manifest.delivery?.mode !== "device-local" || manifest.delivery?.mount_path !== "/workbench/") {
  throw new Error("Unexpected plugin delivery contract");
}
if (manifest.api?.base_path !== "/rolo-api") throw new Error("Unexpected API base path");
if (manifest.integrity?.algorithm !== "sha256" || manifest.integrity?.manifest !== "SHA256SUMS") {
  throw new Error("Unexpected plugin integrity contract");
}

const clientFiles = await collectFiles(clientRoot);
if (!clientFiles.some((file) => file.relative === "index.html")) {
  throw new Error("The client build is missing index.html");
}
if (clientFiles.length + 1 > maxFiles) throw new Error("Plugin package has too many files");
const totalBytes = clientFiles.reduce((sum, file) => sum + file.size, 0);
if (totalBytes > maxTotalBytes) throw new Error("Plugin package exceeds total size budget");

const packageName = `rolo-vis-${packageJson.version}`;
const stageRoot = path.join(dist, "plugin", packageName);
const archivePath = path.join(dist, `${packageName}.zip`);
await Promise.all([
  rm(path.join(dist, "plugin"), { recursive: true, force: true }),
  rm(path.join(dist, "server"), { recursive: true, force: true }),
  rm(path.join(dist, ".openai"), { recursive: true, force: true }),
  rm(archivePath, { force: true }),
  rm(`${archivePath}.sha256`, { force: true }),
]);
await mkdir(stageRoot, { recursive: true });
await copyFile(manifestPath, path.join(stageRoot, "rolo.plugin.json"));

const staged = [{ relative: "rolo.plugin.json", absolute: path.join(stageRoot, "rolo.plugin.json") }];
for (const file of clientFiles) {
  const relative = `dist/client/${file.relative}`;
  const target = path.join(stageRoot, ...relative.split("/"));
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(file.absolute, target);
  staged.push({ relative, absolute: target });
}
staged.sort((left, right) => left.relative.localeCompare(right.relative, "en"));

const checksumLines = [];
for (const file of staged) checksumLines.push(`${sha256(await readFile(file.absolute))}  ${file.relative}`);
const checksumBytes = Buffer.from(`${checksumLines.join("\n")}\n`, "utf8");
await writeFile(path.join(stageRoot, "SHA256SUMS"), checksumBytes);

const archiveFiles = [];
for (const file of staged) {
  archiveFiles.push({ name: `${packageName}/${file.relative}`, data: await readFile(file.absolute) });
}
archiveFiles.push({ name: `${packageName}/SHA256SUMS`, data: checksumBytes });
archiveFiles.sort((left, right) => left.name.localeCompare(right.name, "en"));
const archive = createDeterministicZip(archiveFiles);
await writeFile(archivePath, archive);
await writeFile(`${archivePath}.sha256`, `${sha256(archive)}  ${path.basename(archivePath)}\n`, "utf8");

console.log(JSON.stringify({
  package: packageName,
  files: archiveFiles.length,
  archive: path.relative(root, archivePath).replaceAll(path.sep, "/"),
  sha256: sha256(archive),
}));

