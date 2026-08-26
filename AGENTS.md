# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Durable product decisions

- The selected visual direction is `docs/design/selected-stack-map.png`: dark, topology-first, restrained, and evidence-led.
- The MVP is a read-only rolo plugin. Do not add teleoperation, arbitrary shell commands, arbitrary file browsing, or bypasses around rolo runtime policy.
- The primary screen is Stack Map. Overview, Capabilities, Lifecycle, and Evidence use the same visual system.
- Real rolo API data should be preferred; when unavailable, a clearly labeled demo mode may provide realistic fixture data for evaluation.

Build app UI in `src/`.

- Production delivery is robot-hosted and device-local: rolo serves the validated plugin at `/workbench/` and its API at `/rolo-api` on one robot-owned origin.
- Do not create or deploy a public Sites project. The deleted Sites project and public production URL are not part of the product architecture.
- The approved E23 delivery path uses `rolo-plugin/v2`, relative client assets, deterministic checksums, and the robot-hosted package tests. Sites project files and Sites-only build steps must not be restored.
- Preserve the read-only authority boundary and explicit live-data failure state throughout the delivery migration.
