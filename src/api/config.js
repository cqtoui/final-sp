export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "";
export const API_KEY = import.meta.env.VITE_API_KEY ?? "";

export function apiHeaders(headers = {}) {
  if (!API_KEY) {
    return headers;
  }

  return {
    ...headers,
    "X-API-Key": API_KEY,
  };
}

export function withApiKey(url) {
  if (!url || !API_KEY) {
    return url;
  }

  if (
    url.startsWith("blob:") ||
    url.startsWith("data:")
  ) {
    return url;
  }

  try {
    const parsed = new URL(url, window.location.origin);
    parsed.searchParams.set("api_key", API_KEY);

    if (url.startsWith("http://") || url.startsWith("https://")) {
      return parsed.toString();
    }

    return `${parsed.pathname}${parsed.search}`;
  } catch {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}api_key=${encodeURIComponent(API_KEY)}`;
  }
}

export async function apiFetch(path, options = {}) {
  const url = path.startsWith("http")
    ? path
    : `${API_BASE_URL}${path}`;

  const headers = new Headers(options.headers || {});

  if (API_KEY) {
    headers.set("X-API-Key", API_KEY);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  let body = {};

  try {
    body = await response.json();
  } catch {
    body = {};
  }

  if (!response.ok) {
    const detail = body.detail || body.message || `Request failed (${response.status})`;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }

  return body;
}
