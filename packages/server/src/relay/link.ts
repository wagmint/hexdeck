export interface ParsedConnectLink {
  hexcoreId: string;
  hexcoreName: string;
  wsUrl: string;
  connectCode: string;
}

export interface ExchangedRelayCredentials {
  hexcoreId: string;
  hexcoreName: string;
  wsUrl: string;
  token: string;
  refreshToken: string;
}

/**
 * Parse a hexcore+wss:// connect link into its components.
 * Throws on invalid format or missing required parameters.
 */
export function parseConnectLink(link: string): ParsedConnectLink {
  let url: URL;
  try {
    const normalized = link.replace(/^hexcore\+/, "");
    url = new URL(normalized);
  } catch {
    throw new Error("Invalid connect link format. Expected: hexcore+wss://<host>/ws?p=<hexcoreId>&c=<code>&n=<name>");
  }

  const hexcoreId = url.searchParams.get("p");
  const connectCode = url.searchParams.get("c");
  const hexcoreName = url.searchParams.get("n") || "Unnamed Relay";

  if (!hexcoreId || !connectCode) {
    throw new Error("Connect link missing required parameters (p, c).");
  }

  const wsUrl = `${url.protocol}//${url.host}${url.pathname}`;

  return { hexcoreId, hexcoreName, wsUrl, connectCode };
}

interface ConnectExchangeApiResponse {
  success: boolean;
  message: string;
  data?: {
    accessToken?: string;
    refreshToken?: string;
  };
}

function deriveHttpBaseFromWs(wsUrl: string): string {
  return wsUrl
    .replace(/^wss:/, "https:")
    .replace(/^ws:/, "http:")
    .replace(/\/ws\/?$/, "");
}

/**
 * Exchange a one-time connect code for relay auth tokens.
 */
export async function exchangeConnectLink(parsed: ParsedConnectLink): Promise<ExchangedRelayCredentials> {
  const httpBase = deriveHttpBaseFromWs(parsed.wsUrl);

  const response = await fetch(`${httpBase}/api/auth/connect-exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      hexcoreId: parsed.hexcoreId,
      code: parsed.connectCode,
    }),
  });

  let body: ConnectExchangeApiResponse | null = null;
  try {
    body = (await response.json()) as ConnectExchangeApiResponse;
  } catch {
    body = null;
  }

  if (!response.ok || !body?.success) {
    const message = body?.message || `Connect code exchange failed (${response.status})`;
    throw new Error(message);
  }

  const token = body.data?.accessToken;
  const refreshToken = body.data?.refreshToken;
  if (!token || !refreshToken) {
    throw new Error("Connect exchange returned invalid credentials.");
  }

  return {
    hexcoreId: parsed.hexcoreId,
    hexcoreName: parsed.hexcoreName,
    wsUrl: parsed.wsUrl,
    token,
    refreshToken,
  };
}
