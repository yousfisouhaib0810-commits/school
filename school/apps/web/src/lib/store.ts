import { create } from "zustand";

interface AuthState {
  user: { id: string; email: string; role: string } | null;
  isAuthenticated: boolean;
  setUser: (user: AuthState["user"]) => void;
  login: (user: AuthState["user"]) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user }),
  login: (user) =>
    set({ user, isAuthenticated: true }),
  logout: () =>
    set({ user: null, isAuthenticated: false }),
}));
