import { deriveHttpBaseFromWs } from "./link.js";
import type { NormalizedIntentEvent } from "./intent-events.js";
import type { RelayTarget } from "./types.js";

export async function sendIntentEvents(target: RelayTarget, events: NormalizedIntentEvent[]): Promise<void> {
  if (events.length === 0) return;

  const httpBase = deriveHttpBaseFromWs(target.wsUrl);
  const response = await fetch(`${httpBase}/api/hexcores/${target.hexcoreId}/intent-events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${target.token}`,
    },
    body: JSON.stringify({ events }),
  });

  if (!response.ok) {
    let message = `Intent event ingest failed (${response.status})`;
    try {
      const body = await response.json() as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
}
