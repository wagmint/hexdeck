import type { ProjectInfo, SessionInfo, ParsedSession } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function getProjects(): Promise<ProjectInfo[]> {
  return fetchApi<ProjectInfo[]>("/api/projects");
}

export async function getProjectSessions(
  encodedName: string
): Promise<SessionInfo[]> {
  return fetchApi<SessionInfo[]>(`/api/projects/${encodedName}/sessions`);
}

export async function getSession(sessionId: string): Promise<ParsedSession> {
  return fetchApi<ParsedSession>(`/api/sessions/${sessionId}`);
}
