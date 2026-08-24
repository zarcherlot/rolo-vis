# E3 Episode Studio design QA

**Comparison target**

- Source visual truth: `docs/design/selected-stack-map.png`.
- Implementation evidence: `docs/design/e3-episode-studio-implementation.png`.
- Combined comparison: `docs/design/e3-design-qa-comparison.png`.
- Source pixels: 1486 × 1058. Implementation pixels: 1486 × 1058.
- CSS viewport: 1486 × 1058. Device scale factor: 1. No density normalization was required.
- State: dark desktop workbench, live trusted MentorPi connection, one immutable partial Episode revision, declared COMMAND event selected.

The source and implementation intentionally show different product states: Stack Map
is the visual-system reference, while Episode Studio is a new E3 workflow. The QA
comparison therefore evaluates the shared shell, hierarchy, density, typography,
tokens, evidence language, and inspector anatomy rather than pixel-identical content.

**Findings**

- No remaining P0, P1, or P2 differences.
- Fonts and typography: both views use the established Inter/system sans stack with
  matching compact labels, restrained heading weights, line heights, truncation, and
  high-density inspector copy. The Episode title and top-bar hierarchy match the source.
- Spacing and layout rhythm: the 78 px navigation rail, 72 px top bar, panel borders,
  8–10 px radii, compact gaps, and three-region workbench anatomy carry through. The
  Episode list, timeline, and inspector intentionally replace topology lanes without
  changing the shell rhythm.
- Colors and visual tokens: the implementation reuses the source navy surfaces, soft
  blue borders, primary blue selection, green verified/live state, amber limitation,
  red failure, and violet inference lane. State, outcome, and verification use
  independent tokens.
- Image quality and asset fidelity: the shared rolo mark remains crisp and all visible
  UI symbols use the existing Phosphor icon library. Episode Studio contains no custom
  raster imagery, placeholder art, handcrafted SVG, or media-byte rendering.
- Copy and content: declared, observed, inferred, human-confirmed, and verified language
  follows the approved consumer contract. Agent content is visibly unverified; degraded
  synchronization and missing evidence remain explicit.

**Focused region evidence**

The desktop capture is readable at source resolution, so a separate crop was not
needed. The header/status region confirms independent state/outcome/verification chips;
the right inspector confirms authority, UTC, clock, synchronization, severity, and
Evidence affordance; the lower summary confirms Expected, Observed, and independent
verification remain separate.

**Comparison history**

1. Initial browser capture found one P2 layout issue: status chips stretched to the
   detail-card height and the absolute Evidence button overlapped the Sync fact.
2. The status group was aligned to content height and the Evidence action was moved
   into its own grid cell.
3. The revised 1486 × 1058 capture shows compact chips and unobstructed Clock/Sync
   facts. No actionable P0/P1/P2 issue remains.

**Interaction and responsive verification**

- Feature-gated Episode navigation appeared only after health advertised
  `workbench.episode-read-model/v1`.
- Episode state filtering hid and restored the reference item correctly.
- Selecting the Agent event exposed `Agent inference · unverified`, bounded metrics,
  limitations, and its evidence ID.
- The shared Evidence drawer resolved `episode_event` evidence without console errors.
- 900 × 900: single-column Episode shell, no body overflow.
- 390 × 844: no body overflow; the 500 px metadata timeline scrolls inside its 341 px
  viewport while the selected-event inspector remains present.
- Browser console warnings/errors checked: none.

**Implementation checklist**

- [x] Preserve the reviewed shell and dark evidence-led visual system.
- [x] Keep Episode read-only and feature negotiated.
- [x] Separate outcome, verification, authority, and confidence.
- [x] Pin timeline pagination to one revision.
- [x] Keep simulated/replayed world state and missing evidence visible.
- [x] Verify primary interactions, Evidence integration, and responsive containment.

**Follow-up polish**

- P3: after E3 product review, keyboard roving focus and reduced-motion timeline polish
  can be completed with the V1C hardening work.

final result: passed
