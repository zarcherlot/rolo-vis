# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Durable product decisions

- The selected visual direction is `docs/design/selected-stack-map.png`: dark, topology-first, restrained, and evidence-led.
- The MVP is a read-only rolo plugin. Do not add teleoperation, arbitrary shell commands, arbitrary file browsing, or bypasses around rolo runtime policy.
- Keep `rolo-vis` read-only. Authenticated deployment writes live in the separate `rolo-deployment-control` plugin and must not be merged into the read-only manifest or client.
- `rolo-deployment-control` may hold a Controller bearer token in React memory only. It must never persist the token in browser storage, URLs, logs, fixtures, or build output, and it must not accept SSH private keys or free-form commands.
- Natural-language deployment requests are allowed only through `/v1/session-agent/turns`: the browser freezes an explicit target allowlist, never sends the Controller token to Codex, and displays only broker-sanitized receipts. This is not a terminal or arbitrary-command surface.
- The primary screen is Stack Map. Overview, Capabilities, Lifecycle, and Evidence use the same visual system.
- Real rolo API data should be preferred; when unavailable, a clearly labeled demo mode may provide realistic fixture data for evaluation.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
