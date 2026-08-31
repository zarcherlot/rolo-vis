import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseDeviceHardeningEvidenceBundle } from "../src/contracts/deviceHardeningEvidence.ts";

const inputPath = process.argv[2] || process.env.ROLO_DEVICE_EVIDENCE_BUNDLE;
assert.ok(inputPath, "pass a bundle path or set ROLO_DEVICE_EVIDENCE_BUNDLE");
const bundle = parseDeviceHardeningEvidenceBundle(JSON.parse(await readFile(inputPath, "utf8")));
const verified = bundle.evidence.filter((item) => item.status === "VERIFIED").length;
console.log(`device hardening evidence: ${bundle.evidence.length} scenario(s), ${verified} verified; target ${bundle.target_id}`);
