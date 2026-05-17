// =============================================================================
// GODMODE v1 — Trade Journal
// Rave Organisation | Schema Version 6 — Phase 8 Extended
//
// In-Memory backed journal for Cloud Run. All required fields persisted per entry.
// Bias metadata, CME context, TP ladder outcomes, and PnL fully co-located.
// =============================================================================

import {
  TradeJournalEntry,
  AlchemySignal,
  TPLevel,
  RegimeClass,
  PostMortemSummary,
  BiasCorrelation,
  MacroBias,
  TechnicalBias,
  TradingSession,
} from './ai/types.js';

// ---------------------------------------------------------------------------
// TRADE JOURNAL CLASS
// ---------------------------------------------------------------------------

export class TradeJournal {
  private entries: TradeJournalEntry[] = [];
  
  // Veto tracking for Veto Purity metrics
  private vetoLog: {
    id: number;
    signalId: string;
    timestamp: number;
    symbol: string;
    direction: string;
    vetoReason: string;
    macroBias: string;
    technicalBias: string;
    cmeGapDirection: string;
    compositeScore: number;
    wouldHaveHitSl?: number;
    wouldHaveHitTp1?: number;
    hypotheticalPnlPct?: number;
  }[] = [];

  // TP Ladder events log
  private tpEvents: {
    id: number;
    signalId: string;
    tpLevel: number;
    bybitOrderId: string | null;
    targetPrice: number;
    fillPrice?: number;
    qtyPct: number;
    status: 'Pending' | 'Filled' | 'Cancelled';
    slippageBps?: number;
    filledAt?: number;
    createdAt: number;
  }[] = [];

  private _nextVetoId = 1;
  private _nextTpEventId = 1;

  constructor() {
    console.log('[TradeJournal] In-Memory configuration initialized ✅');
  }

  // -------------------------------------------------------------------------
  // LOG: New signal entry (from Alchemy signal)
  // -------------------------------------------------------------------------

  public logSignal(signal: AlchemySignal, weeklyOpenPrice: number): void {
    const tpLevels = signal.tpLevels;

    const entry: TradeJournalEntry = {
      signalId: signal.signalId,
      timestamp: signal.timestamp,
      symbol: signal.symbol,
      direction: signal.direction,
      entryPrice: signal.entryPrice,
      stopLoss: signal.stopLoss,
      macroBias: signal.macroBias,
      technicalBias: signal.technicalBias,
      cmeGapDirection: signal.cmeGapContext.cmeGapDirection,
      cmeMagneticPull: signal.cmeGapContext.magneticPull,
      session: signal.session,
      tp1Price: tpLevels[0]?.targetPrice ?? 0,
      tp2Price: tpLevels[1]?.targetPrice ?? 0,
      tp3Price: tpLevels[2]?.targetPrice ?? 0,
      vetoFired: signal.vetoFired,
      vetoReason: signal.vetoReason ?? '',
      compositeScore: signal.nineGateResult.compositeScore,
      positionSizeMultiplier: signal.positionSizeMultiplier,
      weeklyOpenPrice,
      tp1Filled: false,
      tp2Filled: false,
      tp3Filled: false,
      slHit: false,
      exitPrice: 0,
      pnlPct: 0,
      regimeClass: 0,
      slippage: 0,
      outlierFlag: false,
    };

    this.entries.push(entry);

    // Log veto separately for Veto Purity tracking
    if (signal.vetoFired) {
      this.logVeto(signal);
    }

    console.log(
      `[TradeJournal] Signal logged: ${signal.signalId.slice(0, 8)} | ` +
        `${signal.direction} ${signal.symbol} @ $${signal.entryPrice}`
    );
  }

  // -------------------------------------------------------------------------
  // LOG: TP deployment (when ladder is placed on exchange)
  // -------------------------------------------------------------------------

  public logTPDeployment(
    signalId: string,
    tpLevel: TPLevel
  ): void {
    this.tpEvents.push({
      id: this._nextTpEventId++,
      signalId,
      tpLevel: tpLevel.level,
      bybitOrderId: tpLevel.bybitOrderId ?? null,
      targetPrice: tpLevel.targetPrice,
      qtyPct: tpLevel.qtyPercent,
      status: tpLevel.status as 'Pending' | 'Filled' | 'Cancelled',
      createdAt: Date.now(),
    });
  }

  // -------------------------------------------------------------------------
  // UPDATE: TP fill outcome
  // -------------------------------------------------------------------------

  public updateTPFill(
    signalId: string,
    tpLevel: 1 | 2 | 3,
    fillPrice: number,
    slippageBps: number
  ): void {
    const entry = this.entries.find(e => e.signalId === signalId);
    if (entry) {
      if (tpLevel === 1) entry.tp1Filled = true;
      if (tpLevel === 2) entry.tp2Filled = true;
      if (tpLevel === 3) entry.tp3Filled = true;
    }

    const event = this.tpEvents.find(e => e.signalId === signalId && e.tpLevel === tpLevel);
    if (event) {
      event.status = 'Filled';
      event.fillPrice = fillPrice;
      event.slippageBps = slippageBps;
      event.filledAt = Date.now();
    }
  }

  // -------------------------------------------------------------------------
  // UPDATE: Trade outcome (SL hit or final exit)
  // -------------------------------------------------------------------------

  public updateOutcome(
    signalId: string,
    exitPrice: number,
    slHit: boolean,
    pnlPct: number,
    slippageBps: number,
    outlierFlag: boolean
  ): void {
    const entry = this.entries.find(e => e.signalId === signalId);
    if (entry) {
      entry.slHit = slHit;
      entry.exitPrice = exitPrice;
      entry.pnlPct = pnlPct;
      entry.slippage = slippageBps;
      entry.outlierFlag = outlierFlag;
    }
  }

  // -------------------------------------------------------------------------
  // UPDATE: Regime class from Phase 8 classifier
  // -------------------------------------------------------------------------

  public updateRegimeClass(signalId: string, regimeClass: RegimeClass): void {
    const entry = this.entries.find(e => e.signalId === signalId);
    if (entry) {
      entry.regimeClass = regimeClass;
    }
  }

  // -------------------------------------------------------------------------
  // LOG: SL cascade — cancel all pending TPs
  // -------------------------------------------------------------------------

  public logInvalidation(signalId: string): void {
    for (const e of this.tpEvents) {
      if (e.signalId === signalId && e.status === 'Pending') {
        e.status = 'Cancelled';
      }
    }
    console.log(`[TradeJournal] SL cascade logged for: ${signalId.slice(0, 8)}`);
  }

  // -------------------------------------------------------------------------
  // QUERY: Fetch all entries for Phase 8 feature matrix
  // -------------------------------------------------------------------------

  public getAllEntries(excludeOutliers = true): TradeJournalEntry[] {
    let result = this.entries.filter(e => e.exitPrice !== 0);
    if (excludeOutliers) {
      result = result.filter(e => !e.outlierFlag);
    }
    return result.sort((a, b) => a.timestamp - b.timestamp);
  }

  // -------------------------------------------------------------------------
  // QUERY: Post-Mortem summary
  // -------------------------------------------------------------------------

  public getPostMortemSummary(): PostMortemSummary {
    const entries = this.getAllEntries();
    const total = entries.length;

    if (total === 0) {
      return this.emptyPostMortem();
    }

    const executed = entries.filter((e) => !e.vetoFired);

    // Veto purity: % of vetoed signals that would have been losses
    const activeVetoes = this.vetoLog.filter(v => v.wouldHaveHitSl !== undefined);
    const vetoPurity =
      activeVetoes.length > 0
        ? activeVetoes.filter((v) => v.wouldHaveHitSl === 1).length /
          activeVetoes.length
        : 0;

    const avgSlippage =
      executed.reduce((sum, e) => sum + e.slippage, 0) /
      (executed.length || 1);

    // Bias correlations
    const macroBiasCorrelations = this.buildBiasCorrelations(
      executed,
      'macroBias'
    );
    const technicalBiasCorrelations = this.buildBiasCorrelations(
      executed,
      'technicalBias'
    );

    // CME aligned win rate
    const cmeAligned = executed.filter(
      (e) => e.cmeGapDirection !== 'None' && e.cmeMagneticPull > 0.4
    );
    const cmeAlignedWins = cmeAligned.filter((e) => e.pnlPct > 0);
    const cmeAlignedWinRate =
      cmeAligned.length > 0 ? cmeAlignedWins.length / cmeAligned.length : 0;

    // Session breakdown
    const sessions: TradingSession[] = ['Asia', 'London', 'NewYork', 'Overlap'];
    const sessionBreakdown = {} as PostMortemSummary['sessionBreakdown'];
    for (const s of sessions) {
      const sEntries = executed.filter((e) => e.session === s);
      const sWins = sEntries.filter((e) => e.pnlPct > 0);
      sessionBreakdown[s] = {
        signals: sEntries.length,
        winRate: sEntries.length > 0 ? sWins.length / sEntries.length : 0,
      };
    }

    return {
      totalSignals: total,
      signalExecutionRate: total > 0 ? executed.length / total : 0,
      avgSlippage,
      vetoPurity,
      avgCompositeScore:
        entries.reduce((sum, e) => sum + e.compositeScore, 0) / total,
      macroBiasCorrelations,
      technicalBiasCorrelations,
      cmeAlignedWinRate,
      sessionBreakdown,
    };
  }

  // -------------------------------------------------------------------------
  // QUERY: Feature matrix for XGBoost (Phase 8)
  // -------------------------------------------------------------------------

  public getFeatureMatrix(): {
    features: number[][];
    labels: number[];
    signalIds: string[];
  } {
    const entries = this.getAllEntries(true);

    const features: number[][] = [];
    const labels: number[] = [];
    const signalIds: string[] = [];

    for (const e of entries) {
      features.push([
        this.encodeBias(e.macroBias),
        this.encodeBias(e.technicalBias),
        this.encodeGapDirection(e.cmeGapDirection),
        e.cmeMagneticPull,
        this.encodeSession(e.session),
        new Date(e.timestamp).getUTCHours(),
        e.compositeScore,
        e.vetoFired ? 1 : 0,
        e.macroBias === e.technicalBias ? 1 : 0,
        e.cmeMagneticPull > 0.5 ? 1 : 0,
      ]);

      // Binary label: 1 = win, 0 = loss
      labels.push(e.pnlPct > 0 ? 1 : 0);
      signalIds.push(e.signalId);
    }

    return { features, labels, signalIds };
  }

  // -------------------------------------------------------------------------
  // PRIVATE HELPERS
  // -------------------------------------------------------------------------

  private logVeto(signal: AlchemySignal): void {
    this.vetoLog.push({
      id: this._nextVetoId++,
      signalId: signal.signalId,
      timestamp: signal.timestamp,
      symbol: signal.symbol,
      direction: signal.direction,
      vetoReason: signal.vetoReason ?? 'Unspecified',
      macroBias: signal.macroBias,
      technicalBias: signal.technicalBias,
      cmeGapDirection: signal.cmeGapContext.cmeGapDirection,
      compositeScore: signal.nineGateResult.compositeScore
    });
  }

  private buildBiasCorrelations(
    entries: TradeJournalEntry[],
    field: 'macroBias' | 'technicalBias'
  ): BiasCorrelation[] {
    const biasValues: (MacroBias | TechnicalBias)[] = [
      'Bullish',
      'Bearish',
      'Neutral',
    ];

    return biasValues.map((bias) => {
      const matching = entries.filter((e) => e[field] === bias);
      const wins = matching.filter((e) => e.pnlPct > 0);
      const avgPnl =
        matching.reduce((sum, e) => sum + e.pnlPct, 0) /
        (matching.length || 1);

      return {
        bias,
        totalSignals: matching.length,
        executedSignals: matching.filter((e) => !e.vetoFired).length,
        wins: wins.length,
        losses: matching.length - wins.length,
        winRate: matching.length > 0 ? wins.length / matching.length : 0,
        avgPnlPct: avgPnl,
        avgRR: 0, // Calculated separately with SL data
      };
    });
  }

  private encodeBias(bias: MacroBias | TechnicalBias): number {
    return bias === 'Bullish' ? 1 : bias === 'Bearish' ? -1 : 0;
  }

  private encodeGapDirection(dir: string): number {
    return dir === 'Above' ? 1 : dir === 'Below' ? -1 : 0;
  }

  private encodeSession(session: TradingSession): number {
    const map: Record<TradingSession, number> = {
      Asia: 0,
      London: 1,
      NewYork: 2,
      Overlap: 3,
    };
    return map[session];
  }

  private emptyPostMortem(): PostMortemSummary {
    return {
      totalSignals: 0,
      signalExecutionRate: 0,
      avgSlippage: 0,
      vetoPurity: 0,
      avgCompositeScore: 0,
      macroBiasCorrelations: [],
      technicalBiasCorrelations: [],
      cmeAlignedWinRate: 0,
      sessionBreakdown: {
        Asia: { signals: 0, winRate: 0 },
        London: { signals: 0, winRate: 0 },
        NewYork: { signals: 0, winRate: 0 },
        Overlap: { signals: 0, winRate: 0 },
      },
    };
  }
}

import { MongoClient } from 'mongodb';
import pg from 'pg';
const { Pool } = pg;

// Singleton export
export const tradeJournal = new TradeJournal();

const mongoUri = process.env["MONGODB_URI"];
const postgresUri = process.env["POSTGRES_URI"];

const mongoClient = mongoUri ? new MongoClient(mongoUri, { serverSelectionTimeoutMS: 2000 }) : null;
let dbConnected = false;
let isConnecting = false;
let lastConnectionAttempt = 0;
const CONNECTION_COOLDOWN_MS = 10000; // Wait 10 seconds before retrying
let journalsCollection: import('mongodb').Collection | null = null;

// Postgres Pool
const pgPool = postgresUri ? new Pool({ connectionString: postgresUri, ssl: { rejectUnauthorized: false } }) : null;
let pgConnected = false;

async function initPg() {
  if (!pgPool || pgConnected) return;
  try {
    const client = await pgPool.connect();
    // Simple table creation if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS journals (
        id BIGINT PRIMARY KEY,
        symbol TEXT,
        side TEXT,
        qty TEXT,
        price TEXT,
        stop_loss TEXT,
        take_profit TEXT,
        order_type TEXT,
        status TEXT,
        mode TEXT,
        veto_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        payload JSONB
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS decision_traces (
        id TEXT PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        symbol TEXT,
        final_decision TEXT,
        contributors JSONB,
        strategy_weights JSONB,
        pnl_snapshot FLOAT,
        payload JSONB
      )
    `);
    client.release();
    pgConnected = true;
    console.log("[PostgreSQL] Connected and table verified");
  } catch (e) {
    console.error("[PostgreSQL] Connection error:", e);
    pgConnected = false;
  }
}

async function initMongo() {
  if (!mongoClient || dbConnected || isConnecting) return;
  
  const now = Date.now();
  if (now - lastConnectionAttempt < CONNECTION_COOLDOWN_MS) {
    return; // Fast fail if we recently tried and failed
  }
  
  isConnecting = true;
  lastConnectionAttempt = now;
  try {
    await mongoClient.connect();
    const db = mongoClient.db("ravebot");
    journalsCollection = db.collection("journals");
    dbConnected = true;
    console.log("[MongoDB] Connected to journal database");
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    if (!errorMsg.includes("Server selection timed out")) {
      console.error("[MongoDB] Connection error:", errorMsg);
    }
    dbConnected = false;
  } finally {
    isConnecting = false;
  }
}

if (postgresUri) {
  initPg().catch(console.error);
}

// MongoDB backed wrappers for existing Express server code
export async function insertJournalEntry(payload: Record<string, unknown>): Promise<string> {
  const id = Date.now();
  payload['id'] = id;
  payload['createdAt'] = new Date();

  // 1. Log to MongoDB
  if (!dbConnected && mongoUri) await initMongo();
  if (dbConnected && journalsCollection) {
    try {
      await journalsCollection.insertOne(payload);
    } catch (e) {
      console.error("[MongoDB] Error inserting journal entry", e);
    }
  }

  // 2. Log to PostgreSQL
  if (!pgConnected && postgresUri) await initPg();
  if (pgConnected && pgPool) {
    try {
      await pgPool.query(
        "INSERT INTO journals (id, symbol, side, qty, price, stop_loss, take_profit, order_type, status, mode, veto_reason, payload) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)",
        [
          id,
          payload['symbol'],
          payload['side'],
          payload['qty'],
          payload['price'],
          payload['stopLoss'],
          payload['takeProfit'],
          payload['orderType'],
          payload['status'],
          payload['mode'],
          payload['vetoReason'],
          JSON.stringify(payload)
        ]
      );
    } catch (e) {
      console.error("[PostgreSQL] Error inserting journal entry", e);
    }
  }

  if (!dbConnected && !pgConnected) {
    console.log("Writing to old journal entry API (No DB Connected)", payload);
  }
  
  return id.toString();
}

export async function getJournalEntries() {
  if (!dbConnected) await initMongo();
  if (dbConnected && journalsCollection) {
    const entries = await journalsCollection.find().sort({ createdAt: -1 }).limit(100).toArray();
    return entries;
  }
  return [];
}

export async function getJournalEntriesSince(date: number) {
  if (!dbConnected) await initMongo();
  if (dbConnected && journalsCollection) {
    const minTimestamp = new Date(date);
    return await journalsCollection.find({ createdAt: { $gt: minTimestamp } }).sort({ createdAt: 1 }).toArray();
  }
  return [];
}

export async function getDbStatus() {
  if (!dbConnected && mongoClient) await initMongo();
  return { status: dbConnected ? "ok" : "disconnected (No MONGODB_URI)" };
}

export async function getJournalReplay(sessionId: string) {
  if (!dbConnected) await initMongo();
  if (dbConnected && journalsCollection) {
    return await journalsCollection.find({ sessionId }).sort({ createdAt: 1 }).toArray();
  }
  return [];
}

export async function getDecisionTraces() {
  if (!pgConnected && postgresUri) await initPg();
  if (pgConnected && pgPool) {
    try {
      const result = await pgPool.query("SELECT * FROM decision_traces ORDER BY timestamp DESC LIMIT 100");
      return result.rows;
    } catch (e) {
      console.error("[PostgreSQL] Error fetching decision traces:", e);
    }
  }
  return [];
}
