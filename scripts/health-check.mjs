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
      throw new Error(`Health no valido (${res.status})`);
    }
    console.log(`[health] OK ${url}`);
  } finally {
    timeout.clear();
  }
}

async function main() {
  const apiHealth = process.env.API_HEALTH_URL || "http://localhost:4001/health";
  await check(apiHealth);
}

main().catch((error) => {
  console.error(`[health] FAIL ${error?.message || error}`);
  process.exit(1);
});

