import assert from "node:assert/strict";
import test from "node:test";

import { topologyLayerForWiki, wikiLayerForTopology } from "../src/contextLink.ts";

test("Wiki and Stack Map share an exact reversible layer mapping", () => {
  const pairs = [
    ["Hardware", "Hardware"],
    ["Linux", "Linux"],
    ["Middleware", "ROS / Middleware"],
    ["Application", "Application"],
  ];

  for (const [wikiLayer, topologyLayer] of pairs) {
    assert.equal(topologyLayerForWiki(wikiLayer), topologyLayer);
    assert.equal(wikiLayerForTopology(topologyLayer), wikiLayer);
  }
});

test("Dependencies never fabricate a dedicated topology lane", () => {
  assert.equal(topologyLayerForWiki("Dependencies"), null);
  assert.equal(wikiLayerForTopology("Dependencies"), null);
  assert.equal(wikiLayerForTopology("Unknown"), null);
});
