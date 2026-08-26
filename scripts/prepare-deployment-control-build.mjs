import { copyFile, readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile("deployment-control/rolo.plugin.json", "utf8"));
if (manifest.id !== "rolo-deployment-control" || manifest.security?.mode !== "authenticated-control") {
  throw new Error("deployment-control manifest is not the independent authenticated plugin");
}
await copyFile("deployment-control/rolo.plugin.json", "dist/deployment-control/rolo.plugin.json");
