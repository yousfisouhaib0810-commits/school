"use client";

import { useEffect } from "react";
import { authSessionBootstrapResponseSchema } from "@school/shared";
import type { AuthSessionBootstrapResponse } from "@school/shared";
import { apiClient } from "@/lib/api";
import { setTenantSubdomain } from "@/lib/auth";
import { useAuthStore } from "@/lib/store";

export function AuthBootstrap() {
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) {
      return;
    }

    async function hydrateSession() {
      const response = await apiClient<AuthSessionBootstrapResponse>("/api/auth/session", {
        parse: (raw: unknown) => authSessionBootstrapResponseSchema.parse(raw),
      });

      if (response.data) {
        setTenantSubdomain(response.data.tenant.subdomain);
        login(response.data.user);
        return;
      }

      if (response.status === 401) {
        logout();
      }
    }

    void hydrateSession();
  }, [isAuthenticated, login, logout]);

  return null;
}
