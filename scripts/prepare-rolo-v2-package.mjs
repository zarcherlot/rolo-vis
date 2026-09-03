#!/usr/bin/env node
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entries = ["rolo.plugin.json"];
const clientRoot = path.join(root, "dist", "client");

function collect(directory) {
  for (const name of readdirSync(directory).sort()) {
    const absolute = path.join(directory, name);
    const stat = lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error(`Refusing symlink in plugin package: ${name}`);
    if (stat.isDirectory()) collect(absolute);
    else entries.push(path.relative(root, absolute).split(path.sep).join("/"));
  }
}

collect(clientRoot);
const lines = entries.sort().map((relative) => {
  const digest = createHash("sha256").update(readFileSync(path.join(root, relative))).digest("hex");
  return `${digest}  ${relative}`;
});
writeFileSync(path.join(root, "SHA256SUMS"), `${lines.join("\n")}\n`, "utf8");
console.log(`Prepared rolo-plugin/v2 checksum manifest: ${lines.length} files`);
