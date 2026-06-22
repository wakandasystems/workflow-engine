import axios from "axios";
import type {
  Application,
  LoginResponse,
  TransitionAction,
} from "../types";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001/api",
  headers: { "Content-Type": "application/json" },
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem("token")) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>("/auth/login", { email, password }).then((r) => r.data),
  me: () => api.get("/auth/me").then((r) => r.data.user),
};

export const applicationsApi = {
  list: (status?: string) =>
    api
      .get<{ applications: Application[] }>("/applications", {
        params: status ? { status } : undefined,
      })
      .then((r) => r.data.applications),

  get: (id: string) =>
    api
      .get<{ application: Application; availableActions: TransitionAction[] }>(
        `/applications/${id}`
      )
      .then((r) => r.data),

  create: (data: {
    title: string;
    category: string;
    description?: string;
    amount?: number | null;
  }) =>
    api
      .post<{ application: Application }>("/applications", data)
      .then((r) => r.data.application),

  update: (
    id: string,
    data: Partial<{
      title: string;
      category: string;
      description: string;
      amount: number | null;
    }>
  ) =>
    api
      .patch<{ application: Application }>(`/applications/${id}`, data)
      .then((r) => r.data.application),

  transition: (id: string, action: TransitionAction, comment?: string) =>
    api
      .post<{ application: Application; availableActions: TransitionAction[] }>(
        `/applications/${id}/transition`,
        { action, comment }
      )
      .then((r) => r.data),

  delete: (id: string) => api.delete(`/applications/${id}`),
};

export default api;
