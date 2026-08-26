# Robot-hosted Workbench delivery baseline candidate

Status: E23D validation candidate

Version: `0.38.0`

Baseline ID: `rolo-vis-robot-hosted-delivery/2026-08`

Extends: rolo-vis `v0.37.0`

Frontend implementation minimum: `2cd1028`

Backend implementation minimum: rolo `827416c`

Candidate archive SHA-256:
`4666b38904a93662c67deff62a31785eb8adc337c8c31cafcab104a8de0e4df0`

Windows development gate: passed

Observation Bundle continuity gate: passed

Linux/robot gate: pending

## Candidate boundary

This candidate changes production delivery from a retired public Sites path to one
device-local package served by rolo. The browser reads `/workbench/` and
`/rolo-api` from the same robot-owned origin. It receives no API token, host selector,
installer, deployment control, shell, arbitrary filesystem, or robot write authority.

The package is `rolo-plugin/v2`, uses relative client assets, and requires a complete
`SHA256SUMS` validation before activation. A changed file fails closed; an invalid
candidate cannot disable the legacy control-plane API.

## Preserved-data validation

The Windows live gate loaded the desktop `rolo-data` directory directly as read-only
configuration and artifacts. It did not copy generated output back into the source.

- Robot: `mentorpi`
- Source files: 40
- Source tree SHA-256:
  `30503fa024fc434a15260b030f78d4c744be83a5523130f4f3112efbf7a96b87`
- Workbench status: `Live trusted`
- Discovery history: 2 manifest-verified snapshots
- Latest discovery: `disc-20260820T115700-f8f2b8ec`, `PARTIAL`
- Capability projection: 294 operations, 0 verified
- Evidence projection: 12 sanitized records
- Wiki limitations and deterministic-rule provenance remained visible.
- Browser console contained no error or warning.

The source tree digest must be recomputed after every remaining gate and must remain
identical.

## Gate coverage

- Windows package extraction and deterministic ZIP rebuild: passed.
- Same-process `/workbench/`, `/rolo-api`, and legacy API compatibility: passed.
- Relative/offline asset loading with a self-only connect policy: passed.
- Trusted-proxy headers do not expand origin or redirect authority: passed.
- Corruption, package mutation, feature mismatch, and rollback selection: covered by
  the paired rolo host gate.
- Episode Observation Bundle feature negotiation and isolated E22 projection: passed.
  The gate retained sequence 2 then 1, `UNAVAILABLE` and `PARTIAL` bundles,
  `REJECTED`, `AVAILABLE`, and `MISSING` sources, 422/409 rejection behavior, and no
  verification influence. The preserved desktop source itself contains no published
  Episode.
- Linux archive extraction, package validation, loopback service startup, and
  robot-owned reverse-proxy routing: pending on a Linux/robot host.

## Promotion rule

No `v0.38.0` tag may be created while the Linux/robot gate is pending. After it passes
and this candidate is reviewed,
merge the paired branches to `main`, replace candidate wording with immutable commit
and package digests, rerun CI, then create the annotated tag. No public site is created
or deployed.
