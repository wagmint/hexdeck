import type { RelayTargetInfo } from "@hexdeck/dashboard-ui";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7433";

export interface ConnectResult {
  error?: string;
  /** Set when link uses invite token (t=) — needs onboarding flow */
  needsOnboarding?: boolean;
  claimId?: string;
  hexcoreName?: string;
  hexcoreId?: string;
  joinUrl?: string;
}

export async function getRelayTargets(): Promise<RelayTargetInfo[]> {
  const res = await fetch(`${API_BASE}/api/relay/targets`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function connectRelay(link: string): Promise<ConnectResult> {
  const res = await fetch(`${API_BASE}/api/relay/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ link }),
  });
  const data = await res.json();
  if (!res.ok) return { error: data.error || "Connection failed" };

  // New onboarding flow
  if (data.needsOnboarding) {
    return {
      needsOnboarding: true,
      claimId: data.claimId,
      hexcoreName: data.hexcoreName,
      hexcoreId: data.hexcoreId,
      joinUrl: data.joinUrl,
    };
  }

  return {};
}

export interface ClaimStatusResult {
  status: "pending" | "completed" | "expired";
  hexcoreId?: string;
  hexcoreName?: string;
}

export async function pollClaimStatus(claimId: string): Promise<ClaimStatusResult> {
  const res = await fetch(`${API_BASE}/api/relay/claim-status/${encodeURIComponent(claimId)}`);
  if (!res.ok) {
    if (res.status === 404) return { status: "expired" };
    return { status: "pending" };
  }
  const data = await res.json();
  return {
    status: data.status,
    hexcoreId: data.hexcoreId,
    hexcoreName: data.hexcoreName,
  };
}

export async function cancelClaim(claimId: string): Promise<void> {
  await fetch(`${API_BASE}/api/relay/claims/${encodeURIComponent(claimId)}`, {
    method: "DELETE",
  });
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
