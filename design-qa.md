# rolo-vis Design QA

## Comparison setup

- Source visual truth: `docs/design/selected-stack-map.png`
- Browser-rendered implementation: `implementation-stack-map-final.png`
- Full-view comparison: `design-qa-comparison-final.png`
- Focused detail comparison: `design-qa-focused-right-final.png`
- Viewport and CSS size: `1440 × 1024`
- Source pixels: `1440 × 1024`
- Implementation pixels: `1440 × 1024`
- Device scale factor: `1`
- Density normalization: none required; source and implementation are equal-density images.
- State: Stack Map, AMR-07 selected, Localization selected, dark theme, evidence inspector open, demo fallback connected.

## Findings

No actionable P0, P1, or P2 visual differences remain.

- Fonts and typography: the implementation uses the target's restrained Inter/system-sans hierarchy, with compact engineering labels and readable 12–16 px interface text. The inspector and topology preserve the source's weight contrast and monospace-like technical density without clipping.
- Spacing and layout rhythm: the 78 px navigation rail, 72 px top bar, four topology lanes, dominant canvas, and fixed right inspector match the source composition. Nodes use consistent row and column rhythm; the selected path remains the visual center.
- Colors and visual tokens: graphite/navy surfaces, cobalt selection, verified green, partial amber, failed red, and dashed gray declared edges map to the source. Contrast remains readable across the primary view.
- Image quality and asset fidelity: the official rolo source mark is used as a high-resolution cropped raster asset. No source imagery was replaced by CSS drawings, handcrafted SVG, emoji, or placeholders. Phosphor supplies all interface icons and React Flow supplies graph connections.
- Copy and content: labels describe real rolo concepts and preserve the source hierarchy. `Observed`, `Partial`, `Failed`, and `Not observed` remain distinct from lifecycle and evidence claims.
- Accessibility and behavior: controls use semantic buttons, labels, visible focus rings, and keyboard-dismissable evidence drawers. Color is reinforced with text, icon, and line-style cues.
- Responsiveness: verified at `1440 × 1024`, `800 × 900`, and `390 × 844`. No document-level horizontal or vertical overflow remains. At narrow widths the inspector yields to the topology canvas, navigation moves to the bottom, and all 20 topology nodes remain within the viewport.

## Focused region evidence

The focused comparison covers the Application lane, Localization inspector, relationship list, observed record, confidence, and evidence actions. The implementation retains the source's selected-node emphasis, compact fact hierarchy, semantic status encoding, and bottom action order. The implementation intentionally uses a two-state read-only trust model and omits operation-invocation controls because the MVP security contract is read-only.

## Interaction verification

Browser-tested primary interactions:

- Open topology search/filter, enter a query, and select a status filter.
- Toggle snapshot comparison and verify the comparison result banner.
- Open and close the evidence drawer.
- Navigate to Capabilities, search operations, and select an operation.
- Navigate to Lifecycle and switch between Adapt, Diagnose, and Verify.
- Navigate to Overview and follow the Stack Map action.
- Verify Evidence navigation, search, filtering, and row selection.
- Confirm `Escape` closes the evidence drawer.

Browser console errors checked: none.

## Comparison history

### Iteration 1

- Earlier P2: the always-visible search toolbar introduced an extra horizontal region and compressed the topology compared with the source.
- Fix: collapsed search and filtering behind a compact canvas control, returned the graph to the full-height primary region, and kept comparison feedback as a temporary overlay.
- Post-fix evidence: `design-qa-comparison-final.png` shows the source and implementation with matching top-level proportions.

### Iteration 2

- Earlier P2: the initial four-row graph left excessive unused vertical space and did not match the source's topology density.
- Fix: expanded the realistic fixture graph to five rows and 20 nodes, including Battery, System Services, Map Server, and Mission Executor.
- Post-fix evidence: `implementation-stack-map-final.png` shows balanced vertical distribution across all four layers.

### Iteration 3

- Earlier P1: at tablet and mobile breakpoints the React Flow canvas collapsed to a 58 px grid row and nodes rendered outside the visible region.
- Fix: corrected responsive grid rows, added ResizeObserver-driven `fitView`, and lowered the minimum zoom for narrow widths.
- Post-fix evidence: browser measurements show `800 × 900` with a `736 × 828` canvas and `390 × 844` with a `390 × 718` canvas; all nodes fit within the mobile viewport.

### Iteration 4

- Earlier P2: the inspector was materially less dense than the source and left excessive blank space below the actions.
- Fix: added source-aligned Status, Since, Node, Lifecycle, Namespace, Observed in, and provenance details while preserving the MVP's bounded read-only scope.
- Post-fix evidence: `design-qa-focused-right-final.png` shows aligned information hierarchy and action placement.

## Follow-up polish

- P3: replace the native inspector scrollbar with a subtler platform-neutral scrollbar treatment.
- P3: add an optional inspector close/reopen control if future usability testing shows value on medium desktop widths.
- P3: localize fixed interface copy after the English engineering vocabulary is validated with users.

## Final result

final result: passed
