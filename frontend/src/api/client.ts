import axios, { AxiosError } from 'axios';

const TOKEN_KEY = 'smartparking.token';
export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const API_ORIGIN = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export const http = axios.create({ baseURL: `${API_ORIGIN}/api`, timeout: 20_000 });

http.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** A failed request, already translated into something we can show to a person. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: Array<{ field: string; message: string }>,
  ) {
    super(message);
  }
}

type SessionListener = (reason: string) => void;
let onSessionExpired: SessionListener | undefined;
export function setSessionExpiredHandler(fn: SessionListener | undefined) {
  onSessionExpired = fn;
}

const SESSION_CODES = new Set(['TOKEN_EXPIRED', 'TOKEN_INVALID', 'ACCOUNT_INACTIVE']);

http.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ error?: { code: string; message: string; details?: ApiError['details'] } }>) => {
    if (!error.response) {
      const message = error.code === 'ECONNABORTED' ? 'The server took too long to respond. Please try again.' : 'Cannot reach the server. Check your connection and try again.';
      return Promise.reject(new ApiError(message, 0, 'NETWORK_ERROR'));
    }
    const body = error.response.data?.error;
    const apiError = new ApiError(body?.message ?? 'Something went wrong. Please try again.', error.response.status, body?.code ?? 'UNKNOWN', body?.details);
    if (SESSION_CODES.has(apiError.code) && tokenStore.get()) onSessionExpired?.(apiError.message);
    return Promise.reject(apiError);
  },
);

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong. Please try again.');
