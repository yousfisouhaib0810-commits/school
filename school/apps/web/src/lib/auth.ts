const TOKEN_KEY = "school_access_token";
const TENANT_SUBDOMAIN_KEY = "school_tenant_subdomain";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(TOKEN_KEY, token);
}

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

export function decodeTokenPayload(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = decodeTokenPayload(token);
  if (!payload || typeof payload.exp !== "number") return true;
  return Date.now() >= payload.exp * 1000;
}
