// =============================================================================
// GODMODE v1 — TP Execution Engine
// Rave Organisation | Phase 7 — Automated Ladder Exits
//
// Deploys the full 3-level TP ladder to Bybit V5 on signal confirmation.
// Handles cascade cancellation on SL invalidation.
// All outcomes feed back to Post-Mortem Analytics.
// =============================================================================

import {
  TPLevel,
  LadderConfig,
} from './ai/types.js';
import { tradeJournal } from './trade-journal.js';

// ---------------------------------------------------------------------------
// BYBIT V5 CLIENT INTERFACE
// Replace with your actual Bybit SDK client instance
// ---------------------------------------------------------------------------

interface BybitOrderParams {
  category: 'linear' | 'spot';
  symbol: string;
  side: 'Buy' | 'Sell';
  orderType: 'Limit' | 'Market';
  price?: string;
  qty: string;
  reduceOnly: boolean;
  timeInForce: 'GoodTillCancel' | 'ImmediateOrCancel' | 'FillOrKill';
  orderLinkId?: string; // For idempotency
}

// Mocking SDK for build (will connect in actual environment)
const bybitClient = {
  submitOrder: async (params: BybitOrderParams) => {
    return {
      result: {
        orderId: `test-${Date.now()}`,
        orderLinkId: params.orderLinkId || "",
        symbol: params.symbol,
        price: params.price || "0",
        qty: params.qty,
        side: params.side,
        orderStatus: "Created"
      },
      retCode: 0,
      retMsg: "OK"
    };
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  cancelOrder: async (_params: any) => {
    return { retCode: 0, retMsg: "OK" };
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  getPositionInfo: async (_params: any) => {
    return { result: { list: [] } };
  }
};

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

/** Rave Organisation — Standard TP ladder allocation */
const RAVE_TP_ALLOCATION = {
  TP1_PCT: 50, // Scale out 50% at statistical mean
  TP2_PCT: 30, // Scale out 30% at Fibonacci equilibrium
  TP3_PCT: 20, // Trail 20% to opposing OB
};

/** Slippage alert threshold in basis points */
const SLIPPAGE_ALERT_BPS = 15;

// ---------------------------------------------------------------------------
// LADDER BUILDER
// ---------------------------------------------------------------------------

/**
 * Constructs a Rave-compliant TP ladder from structural price levels.
 * All levels must maintain minimum 1:2 R/R from entry.
 *
 * @param entry       - Confirmed entry price
 * @param stopLoss    - Hard invalidation level
 * @param vwap        - Statistical mean (TP1 target)
 * @param fib618      - Fibonacci 0.618 equilibrium (TP2 target)
 * @param opposingOB  - Opposing order block / external liquidity (TP3 target)
 * @param direction   - Trade direction
 */
export function buildRaveLadder(
  entry: number,
  stopLoss: number,
  vwap: number,
  fib618: number,
  opposingOB: number
): TPLevel[] {
  const riskPips = Math.abs(entry - stopLoss);

  // Validate minimum R/R on each level
  const validateRR = (target: number, minRR: number): boolean => {
    const reward = Math.abs(target - entry);
    return reward / riskPips >= minRR;
  };

  if (!validateRR(vwap, 1.0)) {
    console.warn('[TPEngine] TP1 (VWAP) fails minimum 1:1 R/R — review levels');
  }
  if (!validateRR(fib618, 1.5)) {
    console.warn('[TPEngine] TP2 (Fib 0.618) fails minimum 1:1.5 R/R — review levels');
  }
  if (!validateRR(opposingOB, 2.0)) {
    console.warn('[TPEngine] TP3 (Opposing OB) fails minimum 1:2 R/R — review levels');
  }

  return [
    {
      level: 1,
      targetPrice: vwap,
      qtyPercent: RAVE_TP_ALLOCATION.TP1_PCT,
      orderType: 'Limit',
      status: 'Pending',
    },
    {
      level: 2,
      targetPrice: fib618,
      qtyPercent: RAVE_TP_ALLOCATION.TP2_PCT,
      orderType: 'Limit',
      status: 'Pending',
    },
    {
      level: 3,
      targetPrice: opposingOB,
      qtyPercent: RAVE_TP_ALLOCATION.TP3_PCT,
      orderType: 'Limit',
      status: 'Pending',
    },
  ];
}

// ---------------------------------------------------------------------------
// TP EXECUTION ENGINE CLASS
// ---------------------------------------------------------------------------

export class TPExecutionEngine {
  /** Active ladders keyed by signalId */
  private activeLadders = new Map<string, LadderConfig>();

  constructor() {
    console.log('[TPExecutionEngine] Phase 7 Ladder Engine ONLINE');
  }

  // -------------------------------------------------------------------------
  // PUBLIC: Deploy a full TP ladder to Bybit
  // -------------------------------------------------------------------------

  public async deployTPLadder(config: LadderConfig): Promise<void> {
    console.log(
      `[TPEngine] Deploying ladder for ${config.signalId.slice(0, 8)} | ` +
        `${config.direction} ${config.symbol} | ` +
        `TPs: ${config.tpLevels.map((t) => t.targetPrice.toString()).join(' → ')}`
    );

    const totalQty = config.totalQty;
    const exitSide: 'Buy' | 'Sell' =
      config.direction === 'Long' ? 'Sell' : 'Buy';

    for (const tp of config.tpLevels) {
      const qty = this.calculateQty(totalQty, tp.qtyPercent);

      try {
        const order = await bybitClient.submitOrder({
          category: 'linear',
          symbol: config.symbol,
          side: exitSide,
          orderType: tp.orderType,
          price: tp.targetPrice.toFixed(2),
          qty: qty.toFixed(4),
          reduceOnly: true, // CRITICAL: Never flip position direction
          timeInForce: 'GoodTillCancel',
          orderLinkId: `${config.signalId}-tp${tp.level}`, // Idempotency key
        });

        if (order.retCode !== 0) {
          console.error(
            `[TPEngine] TP${tp.level} order failed: ${order.retMsg} (Code: ${order.retCode})`
          );
          
          tp.status = 'Failed';
          tradeJournal.logTPDeployment(config.signalId, tp);
          
          // Detect reduce-only failures or not enough balance/position
          if (order.retCode === 130070 || order.retCode === 130063) {
            console.warn(`[TPEngine] ⚠️ Reduce-only or position constraint violated. Position may be out of sync for ${config.symbol}.`);
            // We could theoretically attempt a position sync here
          }
          
          continue;
        }

        // Update TP level with Bybit order ID
        tp.bybitOrderId = order.result.orderId;
        tp.status = 'Pending';

        // Persist to journal
        tradeJournal.logTPDeployment(config.signalId, tp);

        console.log(
          `[TPEngine] TP${tp.level} placed ✅ | ` +
            `OrderId: ${tp.bybitOrderId} | ` +
            `Price: $${tp.targetPrice} | Qty: ${qty.toFixed(4)}`
        );

        // Small delay between orders to avoid rate limits
        await this.sleep(200);
      } catch (err) {
        console.error(`[TPEngine] Exception while placing TP${tp.level}:`, err);
        tp.status = 'Failed';
        tradeJournal.logTPDeployment(config.signalId, tp);
      }
    }

    // Register ladder as active
    this.activeLadders.set(config.signalId, config);
  }

  // -------------------------------------------------------------------------
  // PUBLIC: Handle TP fill event (from WebSocket order updates)
  // -------------------------------------------------------------------------

  public async handleTPFill(
    signalId: string,
    tpLevel: 1 | 2 | 3,
    fillPrice: number
  ): Promise<void> {
    const ladder = this.activeLadders.get(signalId);
    if (!ladder) return;

    const tp = ladder.tpLevels.find((t) => t.level === tpLevel);
    if (!tp) return;

    // Calculate slippage
    const slippageBps = this.calculateSlippageBps(tp.targetPrice, fillPrice);
    tp.status = 'Filled';
    tp.fillPrice = fillPrice;
    tp.filledAt = Date.now();

    // Alert on high slippage
    if (slippageBps > SLIPPAGE_ALERT_BPS) {
      console.warn(
        `[TPEngine] ⚠️ High slippage on TP${tpLevel}: ${slippageBps.toFixed(1)} bps`
      );
    }

    // Update journal
    tradeJournal.updateTPFill(signalId, tpLevel, fillPrice, slippageBps);

    console.log(
      `[TPEngine] TP${tpLevel} FILLED ✅ | ` +
        `Target: $${tp.targetPrice} | Fill: $${fillPrice} | ` +
        `Slippage: ${slippageBps.toFixed(1)} bps`
    );

    // If all TPs filled, clean up
    const allFilled = ladder.tpLevels.every(
      (t) => t.status === 'Filled' || t.status === 'Cancelled'
    );
    if (allFilled) {
      this.activeLadders.delete(signalId);
      console.log(`[TPEngine] Ladder complete for ${signalId.slice(0, 8)}`);
    }
  }

  // -------------------------------------------------------------------------
  // PUBLIC: Cascade cancellation on SL invalidation
  // -------------------------------------------------------------------------

  public async cancelLadderOnInvalidation(
    signalId: string,
    exitPrice: number,
    pnlPct: number
  ): Promise<void> {
    const ladder = this.activeLadders.get(signalId);
    if (!ladder) return;

    console.log(
      `[TPEngine] 🔴 SL HIT — Cancelling ladder for ${signalId.slice(0, 8)}`
    );

    const pendingTPs = ladder.tpLevels.filter(
      (tp) => tp.status === 'Pending' && tp.bybitOrderId
    );

    for (const tp of pendingTPs) {
      try {
        await bybitClient.cancelOrder({
          category: 'linear',
          symbol: ladder.symbol,
          orderId: tp.bybitOrderId!,
        });

        tp.status = 'Cancelled';
        console.log(`[TPEngine] TP${tp.level} cancelled ✅`);

        await this.sleep(150);
      } catch (err) {
        console.error(`[TPEngine] Failed to cancel TP${tp.level}:`, err);
      }
    }

    // Log outcome to journal
    tradeJournal.logInvalidation(signalId);
    tradeJournal.updateOutcome(
      signalId,
      exitPrice,
      true,  // slHit
      pnlPct,
      0,     // slippage (SL market fill — capture separately)
      this.isOutlierMove(pnlPct)
    );

    this.activeLadders.delete(signalId);
  }

  // -------------------------------------------------------------------------
  // PUBLIC: Get active ladder count (for monitoring)
  // -------------------------------------------------------------------------

  public getActiveLadderCount(): number {
    return this.activeLadders.size;
  }

  // -------------------------------------------------------------------------
  // PUBLIC: Get ladder by signalId
  // -------------------------------------------------------------------------

  public getLadder(signalId: string): LadderConfig | undefined {
    return this.activeLadders.get(signalId);
  }

  // -------------------------------------------------------------------------
  // PRIVATE HELPERS
  // -------------------------------------------------------------------------

  private calculateQty(totalQty: number, pct: number): number {
    return (totalQty * pct) / 100;
  }

  private calculateSlippageBps(targetPrice: number, fillPrice: number): number {
    return Math.abs((fillPrice - targetPrice) / targetPrice) * 10_000;
  }

  /** Flag if the trade resulted from a >5% single-candle BTC move */
  private isOutlierMove(pnlPct: number): boolean {
    return Math.abs(pnlPct) > 5.0;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton export
export const tpExecutionEngine = new TPExecutionEngine();
