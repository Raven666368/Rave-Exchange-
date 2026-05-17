// =============================================================================
// GODMODE v1 — Paper Mode Engine
// Rave Organisation | Phase 7 — 48-Hour Data Collection Protocol
//
// Fires simulated signals against live Bybit WebSocket price feed.
// NO live orders are placed. All outcomes are logged to SQLite v6.
// Config is LOCKED during collection — no parameter tuning allowed.
// =============================================================================

import { EventEmitter } from 'events';
import {
  AlchemySignal,
  PriceUpdate,
  TPLevel,
} from './ai/types.js';
import { cmeGapTracker } from './cme-gap-tracker.js';
import { tradeJournal } from './trade-journal.js';
import { buildRaveLadder } from './tp-execution-engine.js';

// ---------------------------------------------------------------------------
// CONSTANTS — LOCKED DURING 48HR COLLECTION WINDOW
// ---------------------------------------------------------------------------

const PAPER_MODE_CONFIG = {
  /** Duration of the collection window in milliseconds */
  COLLECTION_WINDOW_MS: 48 * 60 * 60 * 1000,

  /** Minimum 9-gate composite score to log a signal */
  MIN_COMPOSITE_SCORE: 0.65,

  /** Base position size in USDT (simulated) */
  BASE_POSITION_USDT: 100,

  /** Stop loss distance as % from entry */
  SL_DISTANCE_PCT: 0.8,

  /** TP1 distance from entry as % (VWAP proxy for paper mode) */
  TP1_DISTANCE_PCT: 1.2,

  /** TP2 distance from entry as % (Fib 0.618 proxy) */
  TP2_DISTANCE_PCT: 2.0,

  /** TP3 distance from entry as % (Opposing OB proxy) */
  TP3_DISTANCE_PCT: 3.2,

  /** Outlier flag threshold — BTC move > this % in single candle */
  OUTLIER_THRESHOLD_PCT: 5.0,

  /** Simulated base weekly open price (update on Sunday) */
  WEEKLY_OPEN_PRICE: 0, // Set on engine start
} as const;

// ---------------------------------------------------------------------------
// PAPER MODE METRICS
// ---------------------------------------------------------------------------

export interface PaperModeMetrics {
  startTime: number;
  endTime: number;
  totalSignals: number;
  executedSignals: number;
  vetoedSignals: number;
  wins: number;
  losses: number;
  pendingSignals: number;
  hoursRemaining: number;
  isComplete: boolean;
}

// ---------------------------------------------------------------------------
// ACTIVE PAPER TRADE
// ---------------------------------------------------------------------------

interface ActivePaperTrade {
  signal: AlchemySignal;
  entryPrice: number;
  stopLoss: number;
  tpLevels: TPLevel[];
  openedAt: number;
  tp1Hit: boolean;
  tp2Hit: boolean;
  tp3Hit: boolean;
}

// ---------------------------------------------------------------------------
// PAPER MODE ENGINE CLASS
// ---------------------------------------------------------------------------

export class PaperModeEngine extends EventEmitter {
  private isActive = false;
  private startTime = 0;
  private weeklyOpenPrice = 0;

  /** Open simulated positions */
  private activeTrades = new Map<string, ActivePaperTrade>();

  /** Signal counters */
  private totalSignals = 0;
  private executedSignals = 0;
  private vetoedSignals = 0;
  private wins = 0;
  private losses = 0;

  constructor() {
    super();
    console.log('[PaperMode] Engine instantiated — LIVE CAPITAL PROTECTED 🟢');
  }

  // -------------------------------------------------------------------------
  // PUBLIC: Start the 48-hour collection window
  // -------------------------------------------------------------------------

  public start(currentPrice: number): void {
    if (this.isActive) {
      console.warn('[PaperMode] Already active — ignoring start command');
      return;
    }

    this.isActive = true;
    this.startTime = Date.now();
    this.weeklyOpenPrice = currentPrice; // Anchor weekly open

    console.log('');
    console.log('════════════════════════════════════════════════════════');
    console.log('  GODMODE v1 — PAPER MODE COLLECTION PROTOCOL ACTIVE');
    console.log('  48-Hour data collection window STARTED');
    console.log(`  Start: ${new Date(this.startTime).toUTCString()}`);
    console.log(`  End:   ${new Date(this.startTime + PAPER_MODE_CONFIG.COLLECTION_WINDOW_MS).toUTCString()}`);
    console.log('  ⚠️  Config LOCKED — No parameter tuning during window');
    console.log('  ⚠️  Live limits DISABLED — Paper signals only');
    console.log('════════════════════════════════════════════════════════');
    console.log('');

    // Auto-stop after collection window
    setTimeout(() => this.stop(), PAPER_MODE_CONFIG.COLLECTION_WINDOW_MS);
  }

  // -------------------------------------------------------------------------
  // PUBLIC: Process live price update
  // -------------------------------------------------------------------------

  public onPriceUpdate(update: PriceUpdate): void {
    if (!this.isActive) return;

    // Check collection window expiry
    if (Date.now() - this.startTime > PAPER_MODE_CONFIG.COLLECTION_WINDOW_MS) {
      this.stop();
      return;
    }

    // Update CME gap tracker with live price
    cmeGapTracker.onPriceUpdate(update);

    // Check open paper trades for TP/SL hits
    this.checkOpenTrades(update.price);
  }

  // -------------------------------------------------------------------------
  // PUBLIC: Process an Alchemy signal in paper mode
  // -------------------------------------------------------------------------

  public processPaperSignal(signal: AlchemySignal): void {
    if (!this.isActive) return;

    this.totalSignals++;

    if (signal.vetoFired) {
      this.vetoedSignals++;
      console.log(
        `[PaperMode] VETOED signal ${signal.signalId.slice(0, 8)} | ` +
          `Reason: ${signal.vetoReason}`
      );
    } else {
      this.executedSignals++;
    }

    // Log to SQLite journal (regardless of veto)
    tradeJournal.logSignal(signal, this.weeklyOpenPrice);

    // If not vetoed, open a simulated position
    if (!signal.vetoFired) {
      this.openPaperTrade(signal);
    }

    // Emit metrics update
    this.emit('metrics', this.getMetrics());
  }

  // -------------------------------------------------------------------------
  // PUBLIC: Get current metrics
  // -------------------------------------------------------------------------

  public getMetrics(): PaperModeMetrics {
    const elapsed = Date.now() - this.startTime;
    const remaining = PAPER_MODE_CONFIG.COLLECTION_WINDOW_MS - elapsed;

    return {
      startTime: this.startTime,
      endTime: this.startTime + PAPER_MODE_CONFIG.COLLECTION_WINDOW_MS,
      totalSignals: this.totalSignals,
      executedSignals: this.executedSignals,
      vetoedSignals: this.vetoedSignals,
      wins: this.wins,
      losses: this.losses,
      pendingSignals: this.activeTrades.size,
      hoursRemaining: Math.max(0, remaining / 3_600_000),
      isComplete: !this.isActive && this.startTime > 0,
    };
  }

  // -------------------------------------------------------------------------
  // PUBLIC: Stop collection
  // -------------------------------------------------------------------------

  public stop(): void {
    if (!this.isActive) return;

    this.isActive = false;
    const summary = this.getMetrics();

    console.log('');
    console.log('════════════════════════════════════════════════════════');
    console.log('  PAPER MODE COLLECTION COMPLETE ✅');
    console.log(`  Total Signals:    ${summary.totalSignals}`);
    console.log(`  Executed:         ${summary.executedSignals}`);
    console.log(`  Vetoed:           ${summary.vetoedSignals}`);
    console.log(`  Wins:             ${summary.wins}`);
    console.log(`  Losses:           ${summary.losses}`);
    console.log(`  Pending Trades:   ${summary.pendingSignals}`);
    console.log('');
    console.log('  ✅ Ready for Phase 8 — XGBoost Regime Classifier');
    console.log('════════════════════════════════════════════════════════');
    console.log('');

    this.emit('complete', summary);
  }

  // -------------------------------------------------------------------------
  // PUBLIC: Check if ready for Phase 8 training
  // -------------------------------------------------------------------------

  public isReadyForPhase8(): boolean {
    const { features } = tradeJournal.getFeatureMatrix();
    const hasEnoughData = features.length >= 50;

    if (!hasEnoughData) {
      console.log(
        `[PaperMode] Phase 8 not ready: ${features.length}/50 complete trades logged`
      );
    }

    return hasEnoughData;
  }

  // -------------------------------------------------------------------------
  // PRIVATE: Open simulated position
  // -------------------------------------------------------------------------

  private openPaperTrade(signal: AlchemySignal): void {
    const entry = signal.entryPrice;
    const isLong = signal.direction === 'Long';
    const slMultiplier = isLong ? -1 : 1;

    const stopLoss =
      entry * (1 + (slMultiplier * PAPER_MODE_CONFIG.SL_DISTANCE_PCT) / 100);

    const tp1 =
      entry *
      (1 +
        ((isLong ? 1 : -1) * PAPER_MODE_CONFIG.TP1_DISTANCE_PCT) /
          100);
    const tp2 =
      entry *
      (1 +
        ((isLong ? 1 : -1) * PAPER_MODE_CONFIG.TP2_DISTANCE_PCT) /
          100);
    const tp3 =
      entry *
      (1 +
        ((isLong ? 1 : -1) * PAPER_MODE_CONFIG.TP3_DISTANCE_PCT) /
          100);

    const tpLevels = buildRaveLadder(
      entry,
      stopLoss,
      tp1,
      tp2,
      tp3
    );

    const trade: ActivePaperTrade = {
      signal,
      entryPrice: entry,
      stopLoss,
      tpLevels,
      openedAt: Date.now(),
      tp1Hit: false,
      tp2Hit: false,
      tp3Hit: false,
    };

    this.activeTrades.set(signal.signalId, trade);

    console.log(
      `[PaperMode] 📊 Paper trade OPENED | ${signal.direction} $${entry.toFixed(2)} | ` +
        `SL: $${stopLoss.toFixed(2)} | TP1: $${tp1.toFixed(2)} | TP3: $${tp3.toFixed(2)}`
    );
  }

  // -------------------------------------------------------------------------
  // PRIVATE: Check open trades against current price
  // -------------------------------------------------------------------------

  private checkOpenTrades(currentPrice: number): void {
    for (const [signalId, trade] of this.activeTrades) {
      const isLong = trade.signal.direction === 'Long';

      // --- SL Check ---
      const slHit = isLong
        ? currentPrice <= trade.stopLoss
        : currentPrice >= trade.stopLoss;

      if (slHit) {
        const pnlPct =
          ((currentPrice - trade.entryPrice) / trade.entryPrice) *
          100 *
          (isLong ? 1 : -1);

        const isOutlier =
          Math.abs(pnlPct) > PAPER_MODE_CONFIG.OUTLIER_THRESHOLD_PCT;

        tradeJournal.updateOutcome(
          signalId,
          currentPrice,
          true,
          pnlPct,
          0,
          isOutlier
        );

        this.losses++;
        this.activeTrades.delete(signalId);

        console.log(
          `[PaperMode] 🔴 SL HIT | ${signalId.slice(0, 8)} | ` +
            `Exit: $${currentPrice.toFixed(2)} | PnL: ${pnlPct.toFixed(2)}%${isOutlier ? ' [OUTLIER]' : ''}`
        );
        continue;
      }

      // --- TP Checks ---
      const [tp1, tp2, tp3] = trade.tpLevels;

      if (!trade.tp1Hit) {
        const tp1Hit = isLong
          ? currentPrice >= tp1.targetPrice
          : currentPrice <= tp1.targetPrice;

        if (tp1Hit) {
          trade.tp1Hit = true;
          tradeJournal.updateTPFill(signalId, 1, currentPrice, 0);
          console.log(
            `[PaperMode] 🟡 TP1 HIT | ${signalId.slice(0, 8)} | $${currentPrice.toFixed(2)}`
          );
        }
      }

      if (!trade.tp2Hit) {
        const tp2Hit = isLong
          ? currentPrice >= tp2.targetPrice
          : currentPrice <= tp2.targetPrice;

        if (tp2Hit) {
          trade.tp2Hit = true;
          tradeJournal.updateTPFill(signalId, 2, currentPrice, 0);
          console.log(
            `[PaperMode] 🟡 TP2 HIT | ${signalId.slice(0, 8)} | $${currentPrice.toFixed(2)}`
          );
        }
      }

      if (!trade.tp3Hit) {
        const tp3Hit = isLong
          ? currentPrice >= tp3.targetPrice
          : currentPrice <= tp3.targetPrice;

        if (tp3Hit) {
          trade.tp3Hit = true;
          const pnlPct =
            ((tp3.targetPrice - trade.entryPrice) / trade.entryPrice) *
            100 *
            (isLong ? 1 : -1);

          tradeJournal.updateTPFill(signalId, 3, currentPrice, 0);
          tradeJournal.updateOutcome(
            signalId,
            currentPrice,
            false,
            pnlPct,
            0,
            false
          );

          this.wins++;
          this.activeTrades.delete(signalId);

          console.log(
            `[PaperMode] ✅ TP3 HIT — TRADE COMPLETE | ${signalId.slice(0, 8)} | ` +
              `PnL: ${pnlPct.toFixed(2)}%`
          );
        }
      }
    }
  }
}

// Singleton export
export const paperModeEngine = new PaperModeEngine();
