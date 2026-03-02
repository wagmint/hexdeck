/**
 * In-memory store for pending relay claims.
 * Claims auto-expire after 30 minutes.
 */

const CLAIM_TTL_MS = 30 * 60 * 1000; // 30 minutes

export interface PendingClaim {
  claimId: string;
  claimSecret: string;
  hexcoreId: string;
  hexcoreName: string;
  wsUrl: string;
  inviteToken: string;
  joinUrl: string;
  createdAt: number;
}

const pendingClaims = new Map<string, PendingClaim>();

export function storeClaim(claim: PendingClaim): void {
  pendingClaims.set(claim.claimId, claim);
}

export function getClaim(claimId: string): PendingClaim | undefined {
  const claim = pendingClaims.get(claimId);
  if (!claim) return undefined;

  // Check expiry
  if (Date.now() - claim.createdAt > CLAIM_TTL_MS) {
    pendingClaims.delete(claimId);
    return undefined;
  }

  return claim;
}

export function removeClaim(claimId: string): void {
  pendingClaims.delete(claimId);
}

/** Periodically clean up expired claims */
export function cleanupExpiredClaims(): void {
  const now = Date.now();
  for (const [id, claim] of pendingClaims) {
    if (now - claim.createdAt > CLAIM_TTL_MS) {
      pendingClaims.delete(id);
    }
  }
}
