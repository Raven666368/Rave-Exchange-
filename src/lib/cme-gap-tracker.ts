// =============================================================================
// GODMODE v1 — CME Gap Tracker
// Rave Organisation | Phase 6 — Institutional Memory Layer
//
// Tracks Friday 21:00 UTC closes and Sunday opening imbalances.
// Implements gravitational pull scoring and real-time mitigation detection.
// =============================================================================

import {
  CMEGap,
  CMEGapContext,
  CMEGapDirection,
  PriceUpdate,
} from './ai/types.js';
import { v4 as uuidv4 } from 'uuid';

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

/** Friday session close — 21:00 UTC (CME equity close) */
const CME_CLOSE_HOUR_UTC = 21;
const CME_CLOSE_DAY_UTC = 5; // Friday = 5

/** Sunday open — 22:00 UTC (CME futures reopen) */
const CME_OPEN_HOUR_UTC = 22;
const CME_OPEN_DAY_UTC = 0; // Sunday = 0

/** Minimum gap size to track (filters microstructure noise) */
const MIN_GAP_SIZE_PCT = 0.15;

/** Maximum gap age to remain relevant (days) */
const MAX_GAP_AGE_DAYS = 28;

/** Proximity thresholds for magnetic pull scoring */
const PROXIMITY_ZONES = {
  CRITICAL: 0.5,  // <0.5% distance → pull = 1.0
  HIGH: 1.0,      // <1.0% distance → pull = 0.8
  MEDIUM: 2.0,    // <2.0% distance → pull = 0.5
  LOW: 3.0,       // <3.0% distance → pull = 0.25
  NONE: Infinity, //  >3.0% distance → pull = 0.0
};

// ---------------------------------------------------------------------------
// CME GAP TRACKER CLASS
// ---------------------------------------------------------------------------

export class CMEGapTracker {
  /** All tracked gaps — open and filled */
  private gaps = new Map<string, CMEGap>();

  /** Last recorded Friday close price */
  private pendingFridayClose: number | null = null;

  /** Timestamp of the last Friday close capture */
  private fridayCloseTimestamp: number | null = null;
  
  private lastPrice = 0;

  constructor() {
    console.log('[CMEGapTracker] Initialized — Institutional Memory Layer ONLINE');
  }

  // -------------------------------------------------------------------------
  // PUBLIC: Process incoming price updates
  // -------------------------------------------------------------------------

  /**
   * Called on every price tick from the Bybit WebSocket feed.
   * Handles gap creation on Sunday open and mitigation detection in real-time.
   */
  public onPriceUpdate(update: PriceUpdate): CMEGapContext {
    this.lastPrice = update.price;
    const date = new Date(update.timestamp);
    const dayUTC = date.getUTCDay();
    const hourUTC = date.getUTCHours();

    // --- Capture Friday close ---
    if (dayUTC === CME_CLOSE_DAY_UTC && hourUTC === CME_CLOSE_HOUR_UTC) {
      this.captureFridayClose(update.price, update.timestamp);
    }

    // --- Detect Sunday opening gap ---
    if (
      dayUTC === CME_OPEN_DAY_UTC &&
      hourUTC === CME_OPEN_HOUR_UTC &&
      this.pendingFridayClose !== null
    ) {
      this.detectOpeningGap(update.price, update.timestamp);
    }

    // --- Check mitigation of all open gaps ---
    this.checkMitigation(update.price, update.timestamp);

    // --- Return current gap context ---
    return this.buildGapContext(update.price);
  }

  // -------------------------------------------------------------------------
  // PUBLIC: Get current gap context without processing a price update
  // -------------------------------------------------------------------------

  public getGapContext(currentPrice: number): CMEGapContext {
    return this.buildGapContext(currentPrice);
  }

  // -------------------------------------------------------------------------
  // PUBLIC: Get all open gaps
  // -------------------------------------------------------------------------

  public getOpenGaps(): CMEGap[] {
    return Array.from(this.gaps.values()).filter(
      (g) => g.status === 'Open'
    );
  }

  public lastSeenPrice(): number {
    return this.lastPrice;
  }

  // -------------------------------------------------------------------------
  // PUBLIC: Manually register a gap (for backtesting or manual injection)
  // -------------------------------------------------------------------------

  public registerGap(
    fridayClose: number,
    sundayOpen: number,
    timestamp: number
  ): CMEGap | null {
    return this.createGap(fridayClose, sundayOpen, timestamp);
  }

  // -------------------------------------------------------------------------
  // PRIVATE: Friday close capture
  // -------------------------------------------------------------------------

  private captureFridayClose(price: number, timestamp: number): void {
    // Only capture once per Friday session (first tick at 21:00)
    if (
      this.fridayCloseTimestamp &&
      timestamp - this.fridayCloseTimestamp < 3600_000 // within 1 hour
    ) {
      return;
    }

    this.pendingFridayClose = price;
    this.fridayCloseTimestamp = timestamp;

    console.log(
      `[CMEGapTracker] Friday close captured: $${price.toFixed(2)} at ${new Date(timestamp).toUTCString()}`
    );
  }

  // -------------------------------------------------------------------------
  // PRIVATE: Sunday open gap detection
  // -------------------------------------------------------------------------

  private detectOpeningGap(sundayOpen: number, timestamp: number): void {
    if (this.pendingFridayClose === null) return;

    const fridayClose = this.pendingFridayClose;
    const gap = this.createGap(fridayClose, sundayOpen, timestamp);

    if (gap) {
      console.log(
        `[CMEGapTracker] NEW GAP DETECTED | Direction: ${gap.direction} | ` +
          `Range: $${gap.gapLow.toFixed(2)} - $${gap.gapHigh.toFixed(2)} | ` +
          `Size: ${gap.gapSizePct.toFixed(3)}%`
      );
    }

    // Reset pending close — consumed
    this.pendingFridayClose = null;
  }

  // -------------------------------------------------------------------------
  // PRIVATE: Gap creation
  // -------------------------------------------------------------------------

  private createGap(
    fridayClose: number,
    sundayOpen: number,
    timestamp: number
  ): CMEGap | null {
    const gapHigh = Math.max(fridayClose, sundayOpen);
    const gapLow = Math.min(fridayClose, sundayOpen);
    const gapSizePct = ((gapHigh - gapLow) / gapLow) * 100;

    // Filter microstructure noise
    if (gapSizePct < MIN_GAP_SIZE_PCT) {
      console.log(
        `[CMEGapTracker] Gap too small (${gapSizePct.toFixed(3)}%) — filtered`
      );
      return null;
    }

    // Prune expired gaps before adding new ones
    this.pruneExpiredGaps(timestamp);

    const gap: CMEGap = {
      id: uuidv4(),
      fridayClose,
      sundayOpen,
      gapHigh,
      gapLow,
      gapSizePct,
      direction: sundayOpen > fridayClose ? 'Bullish' : 'Bearish',
      status: 'Open',
      createdAt: timestamp,
    };

    this.gaps.set(gap.id, gap);
    return gap;
  }

  // -------------------------------------------------------------------------
  // PRIVATE: Real-time mitigation detection
  // -------------------------------------------------------------------------

  private checkMitigation(currentPrice: number, timestamp: number): void {
    for (const [id, gap] of this.gaps) {
      if (gap.status !== 'Open') continue;

      // Gap is mitigated when price trades through it
      const mitigated =
        (gap.direction === 'Bullish' && currentPrice <= gap.gapLow) ||
        (gap.direction === 'Bearish' && currentPrice >= gap.gapHigh);

      if (mitigated) {
        gap.status = 'Filled';
        gap.mitigatedAt = timestamp;
        gap.mitigationPrice = currentPrice;
        this.gaps.set(id, gap);

        console.log(
          `[CMEGapTracker] GAP MITIGATED ✅ | ID: ${id.slice(0, 8)} | ` +
            `Price: $${currentPrice.toFixed(2)} | ` +
            `Gap was: $${gap.gapLow.toFixed(2)} - $${gap.gapHigh.toFixed(2)}`
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // PRIVATE: Build gap context for signal injection
  // -------------------------------------------------------------------------

  private buildGapContext(currentPrice: number): CMEGapContext {
    const openGaps = this.getOpenGaps();

    if (openGaps.length === 0) {
      return {
        hasOpenGap: false,
        cmeGapDirection: 'None',
        magneticPull: 0,
        distancePct: Infinity,
      };
    }

    // Find nearest open gap
    let nearestGap: CMEGap | undefined;
    let minDistance = Infinity;

    for (const gap of openGaps) {
      // Distance to nearest boundary of the gap
      const distToHigh = Math.abs(currentPrice - gap.gapHigh);
      const distToLow = Math.abs(currentPrice - gap.gapLow);
      const distance = Math.min(distToHigh, distToLow);

      if (distance < minDistance) {
        minDistance = distance;
        nearestGap = gap;
      }
    }

    if (!nearestGap) {
      return {
        hasOpenGap: false,
        cmeGapDirection: 'None',
        magneticPull: 0,
        distancePct: Infinity,
      };
    }

    const distancePct = (minDistance / currentPrice) * 100;
    const magneticPull = this.calculateMagneticPull(distancePct);

    // Determine direction relative to current price
    let cmeGapDirection: CMEGapDirection;
    if (nearestGap.gapLow > currentPrice) {
      cmeGapDirection = 'Above';
    } else if (nearestGap.gapHigh < currentPrice) {
      cmeGapDirection = 'Below';
    } else {
      // Price is INSIDE the gap — maximum pull
      cmeGapDirection = nearestGap.direction === 'Bullish' ? 'Above' : 'Below';
    }

    return {
      hasOpenGap: true,
      cmeGapDirection,
      magneticPull,
      distancePct,
      nearestGap,
    };
  }

  // -------------------------------------------------------------------------
  // PRIVATE: Magnetic pull scoring (gravitational gradient)
  // -------------------------------------------------------------------------

  private calculateMagneticPull(distancePct: number): number {
    if (distancePct <= PROXIMITY_ZONES.CRITICAL) return 1.0;
    if (distancePct <= PROXIMITY_ZONES.HIGH) return 0.8;
    if (distancePct <= PROXIMITY_ZONES.MEDIUM) return 0.5;
    if (distancePct <= PROXIMITY_ZONES.LOW) return 0.25;
    return 0.0;
  }

  // -------------------------------------------------------------------------
  // PRIVATE: Prune gaps older than MAX_GAP_AGE_DAYS
  // -------------------------------------------------------------------------

  private pruneExpiredGaps(currentTimestamp: number): void {
    const maxAge = MAX_GAP_AGE_DAYS * 86_400_000;

    for (const [id, gap] of this.gaps) {
      if (currentTimestamp - gap.createdAt > maxAge) {
        this.gaps.delete(id);
        console.log(`[CMEGapTracker] Pruned expired gap: ${id.slice(0, 8)}`);
      }
    }
  }
}

// Singleton export
export const cmeGapTracker = new CMEGapTracker();
