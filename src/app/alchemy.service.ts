import { Injectable, signal } from "@angular/core";
import type { CoordinatorResult } from "../lib/ai/types";
import { cmeGapTracker } from "../lib/cme-gap-tracker";

@Injectable({
  providedIn: "root",
})
export class AlchemyService {
  public status = signal<CoordinatorResult | null>(null);
  public isEvaluating = signal<boolean>(false);
  public lastError = signal<string | null>(null);

  async writeJournal(payload: {
    symbol: string;
    side?: "Buy" | "Sell";
    qty?: string;
    price?: string;
    stopLoss?: string;
    takeProfit?: string;
    orderType?: "Limit" | "Market";
    status: "Confirmed" | "Vetoed" | "Error";
    vetoReason?: string;
    mode: string;
    macroBias?: string;
    technicalBias?: string;
    cmeGapDirection?: string;
    cmeMagneticPull?: number;
    session?: string;
    tp1Price?: number;
    tp1Filled?: boolean;
    tp2Price?: number;
    tp2Filled?: boolean;
    tp3Price?: number;
    tp3Filled?: boolean;
    slHit?: boolean;
    pnlPct?: number;
    vetoFired?: boolean;
  }) {
    try {
      await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.error('Failed to write journal entry', e);
    }
  }

  async submitConfirmedTrade(payload: {
    symbol: string;
    side: "Buy" | "Sell";
    qty: string;
    price: string;
    stopLoss: string;
    takeProfit: string;
    tpLevels?: { price: number; percent: number }[];
    orderType: "Limit" | "Market";
    execution_allowed: boolean;
    mode: string;
    macroBias?: string;
    technicalBias?: string;
    cmeGapDirection?: string;
    cmeMagneticPull?: number;
    session?: string;
  }) {
    if (!payload.execution_allowed) {
      throw new Error("Execution not allowed");
    }

    let result;
    try {
      const execRes = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
           symbol: payload.symbol,
           side: payload.side,
           qty: payload.qty,
           price: payload.price,
           stopLoss: payload.stopLoss,
           takeProfit: payload.takeProfit,
           tpLevels: payload.tpLevels,
           sessionId: "alchemy-v5",
           macroBias: payload.macroBias,
           technicalBias: payload.technicalBias,
           cmeGapDirection: payload.cmeGapDirection,
           cmeMagneticPull: payload.cmeMagneticPull,
           session: payload.session,
           vetoFired: false
        })
      });

      if (!execRes.ok) {
         throw new Error("Backend execution failed");
      }

      result = await execRes.json();
      
      return result;
    } catch (e: unknown) {
      await this.writeJournal({
        symbol: payload.symbol,
        side: payload.side,
        qty: payload.qty,
        price: payload.price,
        stopLoss: payload.stopLoss,
        takeProfit: payload.takeProfit,
        orderType: payload.orderType,
        status: "Error",
        vetoReason: e instanceof Error ? e.message : "Execution Failed",
        mode: payload.mode,
        macroBias: payload.macroBias,
        technicalBias: payload.technicalBias
      });
      throw e;
    }
  }

  simulateRiskAssessment() {
    const riskScore = Math.floor(Math.random() * 100) + 1;
    const riskApproved = riskScore <= 70;
    
    return {
      risk_approved: riskApproved,
      risk_score: riskScore,
      forced_mode: riskScore < 30 ? "SAFE_MODE" : (riskScore > 70 ? "SCALP_MODE" : "TREND_MODE"),
      veto_reason: riskApproved ? undefined : "High risk exposure detected",
      max_position_size: riskApproved ? "0.5 BTC" : "0 BTC",
    };
  }

  async runPipeline(prompt: string, tpLevels?: { price: number; percent: number }[], slPercentInput?: number | null, tpPercentInput?: number | null) {
    this.isEvaluating.set(true);
    this.lastError.set(null);

    try {
      // 1. Run initial AI evaluation
      await this.evaluateSetup(prompt);
      const aiStatus = this.status();
      
      if (!aiStatus || !aiStatus.execution_allowed) {
        return; // Evaluation failed or was vetoed, abort pipeline
      }

      // 2. Fetch current market context and trade signal data
      const currentPrice = cmeGapTracker.lastSeenPrice();

      const slPercent = slPercentInput ?? 1;
      const tpPercent = tpPercentInput ?? 5;
      
      const tradeSignal = {
        symbol: "BTCUSDT",
        side: aiStatus.final_action === "LONG" ? "Buy" : (aiStatus.final_action === "SHORT" ? "Sell" : "Buy"),
        qty: "0.1",
        price: currentPrice.toString(),
        stopLoss: (currentPrice * (aiStatus.final_action === "SHORT" ? (1 + slPercent / 100) : (1 - slPercent / 100))).toString(),
        takeProfit: (currentPrice * (aiStatus.final_action === "SHORT" ? (1 - tpPercent / 100) : (1 + tpPercent / 100))).toString(),
        orderType: "Market"
      };

      // 3. Pass to simulated risk assessment function
      const riskAssessment = this.simulateRiskAssessment();

      await this.writeJournal({
        symbol: tradeSignal.symbol,
        status: riskAssessment.risk_approved ? "Confirmed" : "Vetoed",
        vetoReason: riskAssessment.risk_approved ? undefined : riskAssessment.veto_reason,
        mode: riskAssessment.forced_mode
      });

      const statusResult = {
        ...aiStatus,
        ok: aiStatus.ok && riskAssessment.risk_approved,
        failed_gate: riskAssessment.risk_approved ? aiStatus.failed_gate : "Risk Vault",
        execution_allowed: riskAssessment.risk_approved,
        risk: riskAssessment
      } as CoordinatorResult;

      this.status.set(statusResult);

      // 4. Proceed with trade execution or veto
      if (riskAssessment.risk_approved) {
        await this.submitConfirmedTrade({
          symbol: tradeSignal.symbol,
          side: tradeSignal.side as "Buy" | "Sell",
          qty: tradeSignal.qty,
          price: tradeSignal.price,
          stopLoss: tradeSignal.stopLoss,
          takeProfit: tradeSignal.takeProfit,
          tpLevels: tpLevels,
          orderType: tradeSignal.orderType as "Limit" | "Market",
          execution_allowed: true,
          mode: riskAssessment.forced_mode
        });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Pipeline execution failed";
      this.lastError.set(message);
    } finally {
      this.isEvaluating.set(false);
    }
  }

  async evaluateSetup(prompt: string) {
    this.isEvaluating.set(true);
    this.lastError.set(null);
    
    // Inject CME gap context into the prompt
    const currentPrice = cmeGapTracker.lastSeenPrice();
    const cmeContext = cmeGapTracker.getGapContext(currentPrice);
    
    let gapContextStr = "";
    if (cmeContext.hasOpenGap && cmeContext.nearestGap) {
      gapContextStr = `\n\nCME GAP CONTEXT:\nThere are unfilled CME gaps. Nearest gap is ${cmeContext.cmeGapDirection} the current price, at $${cmeContext.nearestGap.fridayClose} to $${cmeContext.nearestGap.sundayOpen}.\nDistance to gap: ${cmeContext.distancePct.toFixed(2)}%.\nMagnetic pull factor: ${cmeContext.magneticPull}. Consider if current price action is drawn towards this level.`;
    }

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt + gapContextStr }),
      });
      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || "Failed to evaluate");
      }
      this.status.set(data as CoordinatorResult);
      if (!data.execution_allowed) {
        await this.writeJournal({
          symbol: "BTCUSDT",
          status: "Vetoed",
          vetoReason: data.failed_gate || data.final_action || "AI Veto",
          mode: data.mode || "Agent",
          macroBias: data.perception?.macro_bias,
          technicalBias: data.perception?.technical_bias,
          cmeGapDirection: cmeContext.cmeGapDirection,
          cmeMagneticPull: cmeContext.magneticPull,
          session: data.perception?.session || "Unknown"
        });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      this.lastError.set(message);
    } finally {
      this.isEvaluating.set(false);
    }
  }
}
