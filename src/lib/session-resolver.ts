// =============================================================================
// GODMODE v1 — Session Resolver
// Rave Organisation | Utility
//
// Derives the correct TradingSession enum from any UTC timestamp.
// Used by Alchemy signal tagging and Phase 8 feature encoding.
// =============================================================================

import { TradingSession } from './ai/types.js';

// ---------------------------------------------------------------------------
// SESSION HOUR RANGES (UTC)
// ---------------------------------------------------------------------------

const SESSION_HOURS: Record<TradingSession, [number, number]> = {
  Asia:    [0, 8],    // 00:00 - 08:00 UTC (Tokyo/Singapore prime)
  London:  [8, 13],   // 08:00 - 13:00 UTC (London open)
  Overlap: [13, 16],  // 13:00 - 16:00 UTC (London/NY overlap — highest volume)
  NewYork: [16, 23],  // 16:00 - 23:00 UTC (NY prime)
};

/**
 * Resolves the active trading session from a UTC timestamp.
 * Asia session is the default for hours not covered by other ranges.
 *
 * @param timestampMs - Unix timestamp in milliseconds
 */
export function resolveSession(timestampMs: number): TradingSession {
  const hourUTC = new Date(timestampMs).getUTCHours();

  for (const [session, [start, end]] of Object.entries(SESSION_HOURS)) {
    if (hourUTC >= start && hourUTC < end) {
      return session as TradingSession;
    }
  }

  // Default: late NY / early Asia transition
  return 'Asia';
}

/**
 * Returns the UTC hour range for a given session.
 */
export function getSessionHours(session: TradingSession): [number, number] {
  return SESSION_HOURS[session];
}

/**
 * Returns true if the current time is within the Asia session.
 * Used for the Asia Reversion Matrix setup filter.
 */
export function isAsiaSession(timestampMs: number): boolean {
  return resolveSession(timestampMs) === 'Asia';
}

/**
 * Returns true if the bot is in high-volume overlap — signals should be
 * weighted higher but SL placement should account for whipsaw.
 */
export function isOverlapSession(timestampMs: number): boolean {
  return resolveSession(timestampMs) === 'Overlap';
}
