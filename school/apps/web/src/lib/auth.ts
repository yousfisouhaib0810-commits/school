const TOKEN_KEY = "school_access_token";
const TENANT_SUBDOMAIN_KEY = "school_tenant_subdomain";

export function clearAccessToken(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(TOKEN_KEY);
}

export function getTenantSubdomain(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TENANT_SUBDOMAIN_KEY);
}

export function setTenantSubdomain(subdomain: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(TENANT_SUBDOMAIN_KEY, subdomain);
}

export function clearTenantSubdomain(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(TENANT_SUBDOMAIN_KEY);
}
