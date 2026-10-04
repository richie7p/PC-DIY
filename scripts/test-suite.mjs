import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const domains = ["src/lib/pc"];
const scope = process.argv[2];
if (!["scaffold", "domain"].includes(scope)) throw new Error("Specify scaffold or domain");
const roots = scope === "domain" ? domains : ["scripts", "src/lib/app-data", "src/lib/auth"];
function discover(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? discover(path) : /\.test\.(mjs|ts)$/.test(path) ? [path] : [];
  });
}
const files = roots.flatMap(discover).sort();
if (!files.length) throw new Error(`No ${scope} tests found`);
const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...files], { stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
