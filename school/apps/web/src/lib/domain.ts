const LOCALHOST_SUFFIX = ".localhost";
const configuredAppDomain = process.env.NEXT_PUBLIC_APP_DOMAIN?.trim().toLowerCase() ?? "";

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().split(":")[0] ?? "";
}

function normalizeAppDomain(appDomain: string): string {
  return appDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function isValidTenantSubdomain(subdomain: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain);
}

export function getTenantSubdomainFromHostname(
  hostname: string,
  appDomain = configuredAppDomain
): string | null {
  const normalizedHostname = normalizeHostname(hostname);

  if (normalizedHostname.endsWith(LOCALHOST_SUFFIX)) {
    const subdomain = normalizedHostname.slice(0, -LOCALHOST_SUFFIX.length);
    return isValidTenantSubdomain(subdomain) ? subdomain : null;
  }

  const normalizedAppDomain = normalizeAppDomain(appDomain);
  if (!normalizedAppDomain || normalizedHostname === normalizedAppDomain) {
    return null;
  }

  const suffix = `.${normalizedAppDomain}`;
  if (!normalizedHostname.endsWith(suffix)) {
    return null;
  }

  const subdomain = normalizedHostname.slice(0, -suffix.length);
  return isValidTenantSubdomain(subdomain) ? subdomain : null;
}

export function getTenantDashboardUrl(
  subdomain: string,
  appDomain = configuredAppDomain
): string | null {
  const normalizedAppDomain = normalizeAppDomain(appDomain);
  if (!normalizedAppDomain || !isValidTenantSubdomain(subdomain)) {
    return null;
  }

  return `https://${subdomain}.${normalizedAppDomain}/dashboard`;
}
