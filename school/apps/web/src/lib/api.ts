import { getTenantSubdomain } from "@/lib/auth";
import { getTenantSubdomainFromHostname } from "@/lib/domain";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "development" ? "http://api.localhost:4000" : "");

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
let csrfToken: string | null = null;

interface ApiOptions<T> extends RequestInit {
  token?: string;
  tenantSubdomain?: string;
  parse?: (data: unknown) => T;
}

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

function getErrorMessage(data: unknown): string | null {
  if (typeof data !== "object" || data === null || !("error" in data)) {
    return null;
  }

  const { error } = data;
  return typeof error === "string" ? error : null;
}

function parseCsrfToken(data: unknown): string | null {
  if (typeof data !== "object" || data === null || !("token" in data)) {
    return null;
  }

  return typeof data.token === "string" ? data.token : null;
}

async function getCsrfToken(): Promise<string | null> {
  if (csrfToken) {
    return csrfToken;
  }

  if (!API_BASE_URL) {
    return null;
  }

  const response = await fetch(`${API_BASE_URL}/api/auth/csrf`, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    return null;
  }

  csrfToken = parseCsrfToken(await response.json().catch(() => null));
  return csrfToken;
}

export async function apiClient(
  path: string,
  options?: ApiOptions<unknown>
): Promise<ApiResponse<unknown>>;

export async function apiClient<T>(
  path: string,
  options: ApiOptions<T> & { parse: (data: unknown) => T }
): Promise<ApiResponse<T>>;

export async function apiClient<T>(
  path: string,
  options: ApiOptions<T> = {}
): Promise<ApiResponse<T | unknown>> {
  const { token, tenantSubdomain: requestedTenantSubdomain, headers: customHeaders, parse, ...rest } = options;

  const headers = new Headers(customHeaders);
  headers.set("Content-Type", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const tenantSubdomain =
    requestedTenantSubdomain ??
    (typeof window !== "undefined"
      ? getTenantSubdomainFromHostname(window.location.hostname) ?? getTenantSubdomain() ?? ""
      : "");

  if (tenantSubdomain) {
    headers.set("X-Tenant-Subdomain", tenantSubdomain);
  }

  try {
    if (!API_BASE_URL) {
      return {
        data: null,
        error: "API URL is not configured",
        status: 0,
      };
    }

    const method = (rest.method ?? "GET").toUpperCase();
    if (UNSAFE_METHODS.has(method)) {
      const tokenValue = await getCsrfToken();
      if (tokenValue) {
        headers.set("X-CSRF-Token", tokenValue);
      }
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers,
      credentials: "include",
    });

    if (!response.ok) {
      const body: unknown = await response.json().catch(() => ({ error: "Request failed" }));
      return {
        data: null,
        error: getErrorMessage(body) ?? `HTTP ${response.status}`,
        status: response.status,
      };
    }

    const rawData: unknown = await response.json();
    const data = parse ? parse(rawData) : rawData;
    return { data, error: null, status: response.status };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "Network error",
      status: 0,
    };
  }
}
