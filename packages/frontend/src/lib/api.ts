import type { AdminUser, PaginatedResponse } from "@droneroute/shared";
import { useMissionStore } from "@/store/missionStore";
import { useAuthStore } from "@/store/authStore";
import { useConfigStore } from "@/store/configStore";

const API_BASE = "/api";

/** One silent re-login shared by all requests that hit an expired session together. */
let relogin: Promise<boolean> | null = null;

async function request<T>(
  path: string,
  options?: RequestInit,
  isRetry = false,
): Promise<T> {
  const token = localStorage.getItem("droneroute_token");
  const trustedSession = localStorage.getItem("droneroute_trusted") === "true";
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (!(options?.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));

    // Expired or invalid session (authMiddleware marks it with SESSION_INVALID,
    // unlike e.g. a wrong password): drop it instead of failing every request
    // with "invalid or expired token".
    if (res.status === 401 && token && err.code === "SESSION_INVALID") {
      // Only clear the session this request was sent with; a newer one (from a
      // parallel re-login or manual sign-in) stays and is used for a retry.
      const current = localStorage.getItem("droneroute_token");
      if (current === token) {
        useAuthStore.getState().expireSession();
      } else if (current && !isRetry) {
        return request<T>(path, options, true);
      }
      // Re-login silently only if the expired session was the shared local
      // account of a trusted network, never in place of a personal account.
      if (
        !isRetry &&
        trustedSession &&
        useConfigStore.getState().trustedLogin
      ) {
        relogin ??= useAuthStore
          .getState()
          .trustedLogin()
          .finally(() => {
            relogin = null;
          });
        if (await relogin) return request<T>(path, options, true);
      }
      throw new Error("Your session has expired. Please sign in again.");
    }

    // Handle banned user — force logout
    if (res.status === 403 && err.banned) {
      useAuthStore.getState().expireSession();
      useMissionStore.getState().clearMission();
      window.location.reload();
      throw new Error(err.error || "Your account has been suspended");
    }

    // Handle unverified email — trigger verification gate
    if (res.status === 403 && err.code === "EMAIL_NOT_VERIFIED") {
      useAuthStore.getState().setNeedsVerification(true);
      throw new Error(err.error || "Email not verified");
    }

    throw new Error(err.error || "Request failed");
  }

  // Check if response is JSON or binary
  const contentType = res.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return res.json();
  }

  return res.blob() as any;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: any) =>
    request<T>(path, {
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  put: <T>(path: string, body?: any) =>
    request<T>(path, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// Admin API
export const adminApi = {
  getUsers: (
    params: {
      page?: number;
      perPage?: number;
      search?: string;
      status?: string;
      sortBy?: string;
      sortOrder?: string;
    } = {},
  ) => {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.perPage) query.set("perPage", String(params.perPage));
    if (params.search) query.set("search", params.search);
    if (params.status) query.set("status", params.status);
    if (params.sortBy) query.set("sortBy", params.sortBy);
    if (params.sortOrder) query.set("sortOrder", params.sortOrder);
    return api.get<PaginatedResponse<AdminUser>>(
      `/admin/users?${query.toString()}`,
    );
  },
  banUser: (id: string) =>
    api.post<{ message: string }>(`/admin/users/${id}/ban`),
  unbanUser: (id: string) =>
    api.post<{ message: string }>(`/admin/users/${id}/unban`),
  promoteUser: (id: string) =>
    api.post<{ message: string }>(`/admin/users/${id}/promote`),
  demoteUser: (id: string) =>
    api.post<{ message: string }>(`/admin/users/${id}/demote`),
};
