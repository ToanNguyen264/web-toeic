const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api").replace(/\/$/, "");

export type AuthUser = { id: string; email: string; is_admin: boolean };
export type AuthResponse = { user: AuthUser; accessToken: string };

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string, public readonly details?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

let accessToken: string | null = null;
let refreshPromise: Promise<AuthResponse> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return response.json() as Promise<T>;
  return (await response.text()) as T;
}

export async function refreshSession(): Promise<AuthResponse> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, { method: "POST", credentials: "include" })
      .then(async (response) => {
        if (!response.ok) {
          setAccessToken(null);
          const body = await parseResponse<{ message?: string; code?: string }>(response);
          throw new ApiError(body.message || "Phiên đăng nhập đã hết hạn.", response.status, body.code);
        }
        const result = await parseResponse<AuthResponse>(response);
        setAccessToken(result.accessToken);
        return result;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, retryAfterRefresh = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, credentials: "include" });
  } catch {
    throw new ApiError("Không thể kết nối tới máy chủ.", 0, "NETWORK_ERROR");
  }

  if (response.status === 401 && retryAfterRefresh && !path.startsWith("/auth/")) {
    await refreshSession();
    return apiRequest<T>(path, init, false);
  }
  if (!response.ok) {
    const body = await parseResponse<{ message?: string; code?: string; details?: unknown }>(response);
    throw new ApiError(body.message || `Yêu cầu thất bại (${response.status}).`, response.status, body.code, body.details);
  }
  return parseResponse<T>(response);
}

export async function fetchProtectedBlob(path: string, init: RequestInit = {}) {
  const makeRequest = () => {
    const headers = new Headers(init.headers);
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    return fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      headers,
    });
  };

  let response: Response;
  try {
    response = await makeRequest();
  } catch {
    throw new ApiError("Không thể kết nối tới máy chủ.", 0, "NETWORK_ERROR");
  }
  if (response.status === 401) {
    await refreshSession();
    try {
      response = await makeRequest();
    } catch {
      throw new ApiError("Không thể kết nối tới máy chủ.", 0, "NETWORK_ERROR");
    }
  }
  if (!response.ok) {
    const body = await parseResponse<{ message?: string; code?: string; details?: unknown } | string>(response);
    const parsedObj = typeof body === "object" && body !== null ? body : undefined;
    throw new ApiError(
      parsedObj?.message || `Không thể tải audio (mã ${response.status}).`,
      response.status,
      parsedObj?.code,
      parsedObj?.details,
    );
  }
  return response.blob();
}

