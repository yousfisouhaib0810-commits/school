const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://api.localhost:4000";

interface ApiOptions<T> extends RequestInit {
  token?: string;
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
  const { token, headers: customHeaders, parse, ...rest } = options;

  const headers = new Headers(customHeaders);
  headers.set("Content-Type", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const tenantSubdomain =
    typeof window !== "undefined"
      ? window.location.hostname.split(".")[0]
      : "";

  if (tenantSubdomain) {
    headers.set("X-Tenant-Subdomain", tenantSubdomain);
  }

  try {
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
