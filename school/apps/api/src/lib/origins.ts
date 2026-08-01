const LOCALHOST_HOSTNAME = "localhost";
const LOCALHOST_SUFFIX = ".localhost";

function normalizeDomain(domain: string | undefined): string | null {
  const trimmed = domain?.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  const withoutProtocol = trimmed.replace(/^https?:\/\//, "");
  return withoutProtocol.replace(/\/$/, "");
}

function isLocalhostTenant(hostname: string): boolean {
  return hostname === LOCALHOST_HOSTNAME || hostname.endsWith(LOCALHOST_SUFFIX);
}

function isPlatformTenantHost(hostname: string, appDomain: string | undefined): boolean {
  const normalizedDomain = normalizeDomain(appDomain);
  if (!normalizedDomain) {
    return false;
  }

  return hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`);
}

export function isAllowedTenantOrigin(
  origin: string,
  allowedOrigins: Set<string>,
  appDomain: string | undefined,
  nodeEnv: string
): boolean {
  try {
    const { hostname, origin: normalizedOrigin, protocol } = new URL(origin);

    if (nodeEnv !== "production" && isLocalhostTenant(hostname)) {
      return true;
    }

    if (allowedOrigins.has(normalizedOrigin)) {
      return true;
    }

    if (nodeEnv === "production" && protocol !== "https:") {
      return false;
    }

    return isPlatformTenantHost(hostname, appDomain);
  } catch {
    return false;
  }
}
