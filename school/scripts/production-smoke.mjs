const DEFAULT_WEB_URL = "https://school-mu-one.vercel.app";
const DEFAULT_API_URL = "https://school-luuv.onrender.com";
const REQUEST_TIMEOUT_MS = 30_000;

const webUrl = normalizeBaseUrl(process.env.PRODUCTION_WEB_URL ?? DEFAULT_WEB_URL);
const apiUrl = normalizeBaseUrl(process.env.PRODUCTION_API_URL ?? DEFAULT_API_URL);

const checks = [
  {
    name: "web home",
    url: `${webUrl}/`,
    expectedStatuses: new Set([200]),
    mustContain: ["School Platform", "إنشاء حساب"],
  },
  {
    name: "web register",
    url: `${webUrl}/register`,
    expectedStatuses: new Set([200]),
    mustContain: ["إنشاء حساب"],
  },
  {
    name: "web forgot password",
    url: `${webUrl}/forgot-password`,
    expectedStatuses: new Set([200]),
    mustContain: ["استعادة كلمة المرور"],
  },
  {
    name: "api health",
    url: `${apiUrl}/api/health`,
    expectedStatuses: new Set([200]),
    mustContain: ['"status":"ok"'],
  },
  {
    name: "api readiness",
    url: `${apiUrl}/api/readiness`,
    expectedStatuses: new Set([200, 503]),
    mustContain: ['"checks"'],
  },
];

function normalizeBaseUrl(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    return { response, text };
  } finally {
    clearTimeout(timeout);
  }
}

function compactBody(text) {
  return text.replaceAll(/\s+/g, " ").slice(0, 240);
}

let failures = 0;

for (const check of checks) {
  try {
    const { response, text } = await fetchText(check.url);
    const statusOk = check.expectedStatuses.has(response.status);
    const contentOk = check.mustContain.every((item) => text.includes(item));

    if (statusOk && contentOk) {
      console.log(`PASS ${check.name}: ${response.status} ${check.url}`);
      continue;
    }

    failures += 1;
    console.error(`FAIL ${check.name}: ${response.status} ${check.url}`);
    if (!statusOk) {
      console.error(`  expected status: ${Array.from(check.expectedStatuses).join(" or ")}`);
    }
    if (!contentOk) {
      console.error(`  expected body to include: ${check.mustContain.join(", ")}`);
    }
    console.error(`  body: ${compactBody(text)}`);
  } catch (error) {
    failures += 1;
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`FAIL ${check.name}: ${message}`);
  }
}

if (failures > 0) {
  console.error(`Production smoke failed: ${failures} check(s) failed.`);
  process.exit(1);
}

console.log("Production smoke passed.");
