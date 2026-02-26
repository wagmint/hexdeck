import type { DashboardState, FeedEvent } from "@hexdeck/dashboard-ui";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7433";

export const SSE_DASHBOARD_URL = `${API_BASE}/api/dashboard/stream`;

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function getDashboardState(): Promise<DashboardState> {
  return fetchApi<DashboardState>("/api/dashboard");
}

export async function getDashboardFeed(limit = 50): Promise<FeedEvent[]> {
  return fetchApi<FeedEvent[]>(`/api/dashboard/feed?limit=${limit}`);
}
