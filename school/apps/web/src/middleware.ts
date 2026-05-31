import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const RESERVED_SUBDOMAINS = new Set([
  "admin",
  "api",
  "www",
  "mail",
  "ftp",
  "app",
  "auth",
  "login",
  "signup",
  "root",
  "support",
  "billing",
  "dashboard",
  "static",
  "cdn",
  "assets",
  "media",
  "blog",
  "docs",
  "help",
]);

function getLocalhostSubdomain(hostname: string): string | null {
  const [subdomain] = hostname.split(".");
  if (!hostname.endsWith(".localhost") || !subdomain || subdomain === "localhost") {
    return null;
  }

  return subdomain;
}

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const hostname = host.split(":")[0] ?? "";
  const subdomain = getLocalhostSubdomain(hostname);

  if (!subdomain) {
    return NextResponse.next();
  }

  if (RESERVED_SUBDOMAINS.has(subdomain)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("X-Tenant-Subdomain", subdomain);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
