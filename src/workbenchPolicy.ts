export type WorkbenchMode = "connecting" | "live" | "partial" | "unavailable" | "demo";
export type WorkbenchSurface = "overview" | "stack" | "capabilities" | "lifecycle" | "evidence";
export type SurfaceSource = "live" | "demo" | "unavailable";

const LIVE_SURFACES = new Set<WorkbenchSurface>(["overview", "lifecycle"]);

export function getSurfaceSource(mode: WorkbenchMode, surface: WorkbenchSurface): SurfaceSource {
  if (mode === "demo") return "demo";
  if ((mode === "live" || mode === "partial") && LIVE_SURFACES.has(surface)) return "live";
  return "unavailable";
}
