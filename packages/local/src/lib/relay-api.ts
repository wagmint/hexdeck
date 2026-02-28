import type { RelayTargetInfo } from "@hexdeck/dashboard-ui";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7433";

export async function getRelayTargets(): Promise<RelayTargetInfo[]> {
  const res = await fetch(`${API_BASE}/api/relay/targets`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function connectRelay(link: string): Promise<{ error?: string }> {
  const res = await fetch(`${API_BASE}/api/relay/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ link }),
  });
  const data = await res.json();
  if (!res.ok) return { error: data.error || "Connection failed" };
  return {};
}

export async function removeRelayTarget(hexcoreId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/relay/targets/${encodeURIComponent(hexcoreId)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
}

export async function includeProject(hexcoreId: string, projectPath: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/relay/targets/${encodeURIComponent(hexcoreId)}/include`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectPath }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
}

export async function excludeProject(hexcoreId: string, projectPath: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/relay/targets/${encodeURIComponent(hexcoreId)}/exclude`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectPath }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
}
