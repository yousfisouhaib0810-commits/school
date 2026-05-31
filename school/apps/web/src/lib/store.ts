import { create } from "zustand";

interface AuthState {
  user: { id: string; email: string; role: string } | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setUser: (user: AuthState["user"]) => void;
  setAccessToken: (token: string | null) => void;
  login: (user: AuthState["user"], token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  setUser: (user) => set({ user }),
  setAccessToken: (token) => set({ accessToken: token }),
  login: (user, token) =>
    set({ user, accessToken: token, isAuthenticated: true }),
  logout: () =>
    set({ user: null, accessToken: null, isAuthenticated: false }),
}));
