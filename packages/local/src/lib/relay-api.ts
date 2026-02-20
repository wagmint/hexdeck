import type { RelayTargetInfo } from "@pylon-dev/dashboard-ui";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

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

export async function removeRelayTarget(pylonId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/relay/targets/${encodeURIComponent(pylonId)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
}

export async function includeProject(pylonId: string, projectPath: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/relay/targets/${encodeURIComponent(pylonId)}/include`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectPath }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
}

export async function excludeProject(pylonId: string, projectPath: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/relay/targets/${encodeURIComponent(pylonId)}/exclude`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectPath }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
}
