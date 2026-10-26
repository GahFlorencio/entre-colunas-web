declare global {
  interface Window {
    __APP_CONFIG__?: { VITE_API_URL?: string };
  }
}

export const apiUrl =
  (typeof window !== "undefined"
    ? window.__APP_CONFIG__?.VITE_API_URL
    : undefined) ??
  import.meta.env.VITE_API_URL ??
  "/api";
