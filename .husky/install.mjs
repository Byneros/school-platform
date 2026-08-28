import { constants, existsSync, accessSync } from "node:fs";
import { spawnSync } from "node:child_process";

const isCi = String(process.env.CI || "").toLowerCase() === "true";
const isProduction = String(process.env.NODE_ENV || "").toLowerCase() === "production";
const shouldInstall = String(process.env.HUSKY_INSTALL || "").toLowerCase() === "true";

if (isCi || isProduction || !shouldInstall) {
  process.exit(0);
}

const bin = process.platform === "win32" ? "husky.cmd" : "husky";
const hasLocalHusky =
  existsSync("node_modules/.bin/husky") || existsSync("node_modules/.bin/husky.cmd");

if (!hasLocalHusky) {
  process.exit(0);
}

try {
  accessSync(".git/config", constants.W_OK);
} catch {
  process.exit(0);
}

const result = spawnSync(bin, { stdio: "inherit", shell: true });
process.exit(result.status ?? 0);
