export interface ParsedConnectLink {
  pylonId: string;
  pylonName: string;
  wsUrl: string;
  token: string;
  refreshToken: string;
}

/**
 * Parse a pylon+wss:// connect link into its components.
 * Throws on invalid format or missing required parameters.
 */
export function parseConnectLink(link: string): ParsedConnectLink {
  let url: URL;
  try {
    const normalized = link.replace(/^pylon\+/, "");
    url = new URL(normalized);
  } catch {
    throw new Error("Invalid connect link format. Expected: pylon+wss://<host>/ws?p=<pylonId>&t=<token>&r=<refreshToken>&n=<name>");
  }

  const pylonId = url.searchParams.get("p");
  const token = url.searchParams.get("t");
  const refreshToken = url.searchParams.get("r");
  const pylonName = url.searchParams.get("n") || "Unnamed Relay";

  if (!pylonId || !token || !refreshToken) {
    throw new Error("Connect link missing required parameters (p, t, r).");
  }

  const wsUrl = `${url.protocol}//${url.host}${url.pathname}`;

  return { pylonId, pylonName, wsUrl, token, refreshToken };
}
