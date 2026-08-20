export type WorkbenchMode = "connecting" | "live" | "partial" | "unavailable" | "demo";
export type WorkbenchSurface = "overview" | "stack" | "capabilities" | "lifecycle" | "evidence";
export type SurfaceSource = "live" | "demo" | "unavailable";

const LIVE_SURFACES = new Set<WorkbenchSurface>(["overview", "lifecycle"]);

export function getSurfaceSource(
  mode: WorkbenchMode,
  surface: WorkbenchSurface,
  availability: Partial<Record<WorkbenchSurface, boolean>> = {},
): SurfaceSource {
  if (mode === "demo") return "demo";
  const available = availability[surface] ?? LIVE_SURFACES.has(surface);
  if ((mode === "live" || mode === "partial") && available) return "live";
  return "unavailable";
}

export function getOverviewPresentation(
  mode: WorkbenchMode,
  overview: { state: string; summary: string } | null,
  pipelineSummary?: string,
): { title: string; summary: string } {
  const title = overview?.state === "READY"
    ? "Ready"
    : overview?.state === "DEGRADED"
      ? "Degraded"
      : mode === "demo"
        ? "Demo attention required"
        : overview
          ? "Attention required"
          : "Pipeline compatibility";
  const summary = overview?.summary
    || (mode === "demo"
      ? "Demo data shows an Adapt dependency mismatch."
      : pipelineSummary || "The overview read model is unavailable; only pipeline facts are shown.");
  return { title, summary };
}
