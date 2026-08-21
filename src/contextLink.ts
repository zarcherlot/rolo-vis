import type { WikiLayer } from "./types/rolo";

export type TopologyDisplayLayer = "Hardware" | "Linux" | "ROS / Middleware" | "Application";
export type ContextWikiLayer = Exclude<WikiLayer, "Dependencies">;

const WIKI_TO_TOPOLOGY: Record<ContextWikiLayer, TopologyDisplayLayer> = {
  Hardware: "Hardware",
  Linux: "Linux",
  Middleware: "ROS / Middleware",
  Application: "Application",
};

export function topologyLayerForWiki(layer: WikiLayer): TopologyDisplayLayer | null {
  return layer === "Dependencies" ? null : WIKI_TO_TOPOLOGY[layer];
}

export function wikiLayerForTopology(layer: string): ContextWikiLayer | null {
  const entry = Object.entries(WIKI_TO_TOPOLOGY).find(([, topologyLayer]) => topologyLayer === layer);
  return (entry?.[0] as ContextWikiLayer | undefined) || null;
}
