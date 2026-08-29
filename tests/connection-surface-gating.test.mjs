import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("connection failure is scoped to Overview instead of short-circuiting every tab", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(app, /const connectionUnavailable = \[\"connecting\", \"unavailable\"\]\./);
  assert.match(app, /active === \"overview\" && \(connectionUnavailable \?/);
  assert.equal(
    app.includes('(["connecting", "unavailable"].includes(mode) || !robot) && active !== "analysis"'),
    false,
  );
});
