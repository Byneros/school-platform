import process from "node:process";

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, clear: () => clearTimeout(timer) };
}

async function check(url) {
  const timeout = withTimeout(5000);
  try {
    const res = await fetch(url, { signal: timeout.controller.signal });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.ok !== true) {
      const checks = json?.checks ? ` checks=${JSON.stringify(json.checks)}` : "";
      throw new Error(`Health no valido (${res.status})${checks}`);
    }
    const checks = json?.checks ? ` ${JSON.stringify(json.checks)}` : "";
    console.log(`[health] OK ${url}${checks}`);
  } finally {
    timeout.clear();
  }
}

async function main() {
  const port = process.env.PORT || "4003";
  const apiHealth =
    process.env.API_HEALTH_URL || process.env.API_READY_URL || `http://localhost:${port}/ready`;
  await check(apiHealth);
}

main().catch((error) => {
  console.error(`[health] FAIL ${error?.message || error}`);
  process.exit(1);
});
