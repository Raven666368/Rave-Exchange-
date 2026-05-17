// =============================================================================
// GODMODE v1 — Core Type Definitions
// Rave Organisation | Schema Version 6
// All Phase 8 extended fields included. Strict TypeScript — no 'any'.
// =============================================================================

// ---------------------------------------------------------------------------
// ENUMS — Single source of truth for all bias/session/direction values
// ---------------------------------------------------------------------------

export type MacroBias = 'Bullish' | 'Bearish' | 'Neutral';
export type TechnicalBias = 'Bullish' | 'Bearish' | 'Neutral';
export type TradeDirection = 'Long' | 'Short';
export type TPStatus = 'Pending' | 'Filled' | 'Cancelled' | 'Failed';
export type OrderType = 'Limit' | 'Market';
export type RegimeClass = 0 | 1 | 2; // 0=Low, 1=Medium, 2=High confidence

/** Trading session derived from UTC hour at signal fire time */
export type TradingSession = 'Asia' | 'London' | 'NewYork' | 'Overlap';

/** CME gap direction relative to current price */
export type CMEGapDirection = 'Above' | 'Below' | 'None';

/** Gap mitigation status */
export type GapStatus = 'Open' | 'Filled' | 'Partial';

// ---------------------------------------------------------------------------
// CME GAP TYPES
// ---------------------------------------------------------------------------

export interface CMEGap {
  id: string;
  /** Friday 21:00 UTC close price */
  fridayClose: number;
  /** Sunday open price that created the gap */
  sundayOpen: number;
  /** Gap upper boundary */
  gapHigh: number;
  /** Gap lower boundary */
  gapLow: number;
  /** Gap size in percentage terms */
  gapSizePct: number;
  /** Bullish gap = Sunday opened above Friday close */
  direction: 'Bullish' | 'Bearish';
  status: GapStatus;
  /** UTC timestamp of gap creation */
  createdAt: number;
  /** UTC timestamp of mitigation (if filled) */
  mitigatedAt?: number;
  /** Price at which gap was mitigated */
  mitigationPrice?: number;
}

export interface CMEGapContext {
  /** Whether an open CME gap exists near current price */
  hasOpenGap: boolean;
  /** Direction of the nearest open gap relative to current price */
  cmeGapDirection: CMEGapDirection;
  /** 0.0 (far) → 1.0 (at gap boundary) gravitational pull score */
  magneticPull: number;
  /** Price distance to nearest gap boundary in % */
  distancePct: number;
  /** The nearest open gap details */
  nearestGap?: CMEGap;
}

// ---------------------------------------------------------------------------
// SIGNAL & ALCHEMY TYPES
// ---------------------------------------------------------------------------

export interface NineGateResult {
  /** All 9 gates passed */
  passed: boolean;
  /** Individual gate scores 0-1 */
  gates: {
    structuralBreak: number;
    liquiditySweep: number;
    fairValueGap: number;
    orderBlock: number;
    fibConfluence: number;
    vwapDeviation: number;
    bollingerExtension: number;
    cmeGapAlignment: number;
    sentimentExhaustion: number;
  };
  /** Composite confluence score 0-1 */
  compositeScore: number;
}

export interface AlchemySignal {
  signalId: string;
  symbol: string;
  timestamp: number;
  direction: TradeDirection;
  entryPrice: number;
  stopLoss: number;
  /** TP ladder levels */
  tpLevels: TPLevel[];
  macroBias: MacroBias;
  technicalBias: TechnicalBias;
  session: TradingSession;
  cmeGapContext: CMEGapContext;
  nineGateResult: NineGateResult;
  /** True if Alchemy vetoed the signal despite gate pass */
  vetoFired: boolean;
  vetoReason?: string;
  /** Multiplier applied to base position size (0.5x / 1.0x / 1.25x) */
  positionSizeMultiplier: number;
}

// ---------------------------------------------------------------------------
// TP EXECUTION TYPES
// ---------------------------------------------------------------------------

export interface TPLevel {
  level: 1 | 2 | 3;
  targetPrice: number;
  /** Percentage of total position to close at this level */
  qtyPercent: number;
  orderType: OrderType;
  status: TPStatus;
  /** Bybit order ID once submitted */
  bybitOrderId?: string;
  /** UTC timestamp of fill */
  filledAt?: number;
  /** Actual fill price (may differ from target due to slippage) */
  fillPrice?: number;
}

export interface LadderConfig {
  positionId: string;
  symbol: string;
  direction: TradeDirection;
  entryPrice: number;
  stopLoss: number;
  totalQty: number;
  tpLevels: TPLevel[];
  cmeGapContext: CMEGapContext;
  signalId: string;
}

// ---------------------------------------------------------------------------
// TRADE JOURNAL — Schema v6 (Phase 8 Extended)
// All 20 fields required. No optional fields in the persisted record.
// ---------------------------------------------------------------------------

export interface TradeJournalEntry {
  // --- Core Identity ---
  signalId: string;
  timestamp: number;
  symbol: string;

  // --- Execution ---
  direction: TradeDirection;
  entryPrice: number;
  stopLoss: number;

  // --- Bias Labels (Phase 5 — Alchemy tagging) ---
  macroBias: MacroBias;
  technicalBias: TechnicalBias;

  // --- CME Context (Phase 6) ---
  cmeGapDirection: CMEGapDirection;
  cmeMagneticPull: number; // 0.0 - 1.0

  // --- Session (Phase 7) ---
  session: TradingSession;

  // --- TP Ladder (Phase 7) ---
  tp1Price: number;
  tp1Filled: boolean;
  tp2Price: number;
  tp2Filled: boolean;
  tp3Price: number;
  tp3Filled: boolean;

  // --- Outcome ---
  slHit: boolean;
  exitPrice: number;
  pnlPct: number;

  // --- AI Decision Audit ---
  vetoFired: boolean;
  vetoReason: string; // Empty string if not vetoed

  // --- Phase 8 Extended Fields (Schema v6) ---
  compositeScore: number;       // 9-gate composite 0-1
  positionSizeMultiplier: number;
  regimeClass: RegimeClass;     // Classifier output (0/1/2)
  slippage: number;             // Entry slippage in bps
  outlierFlag: boolean;         // True if BTC moved >5% in single candle
  weeklyOpenPrice: number;      // Sunday open for VWAP anchor
}

// ---------------------------------------------------------------------------
// POST-MORTEM ANALYTICS TYPES
// ---------------------------------------------------------------------------

export interface BiasCorrelation {
  bias: MacroBias | TechnicalBias;
  totalSignals: number;
  executedSignals: number;
  wins: number;
  losses: number;
  winRate: number;
  avgPnlPct: number;
  avgRR: number;
}

export interface PostMortemSummary {
  totalSignals: number;
  signalExecutionRate: number;   // % of signals that passed veto
  avgSlippage: number;           // bps
  vetoPurity: number;            // % of vetoed signals that would have lost
  avgCompositeScore: number;
  macroBiasCorrelations: BiasCorrelation[];
  technicalBiasCorrelations: BiasCorrelation[];
  cmeAlignedWinRate: number;     // Win rate when trade aligned with CME gap
  sessionBreakdown: Record<TradingSession, { signals: number; winRate: number }>;
}

// ---------------------------------------------------------------------------
// REGIME CLASSIFIER TYPES (Phase 8)
// ---------------------------------------------------------------------------

export interface RegimeFeatureVector {
  // Encoded features fed to XGBoost
  macroBiasEncoded: number;      // Bullish=1, Neutral=0, Bearish=-1
  technicalBiasEncoded: number;  // Bullish=1, Neutral=0, Bearish=-1
  cmeGapDirectionEncoded: number;// Above=1, None=0, Below=-1
  cmeMagneticPull: number;       // 0.0 - 1.0
  sessionEncoded: number;        // Asia=0, London=1, NY=2, Overlap=3
  hourOfDay: number;             // 0-23 UTC
  compositeScore: number;        // 9-gate score 0-1
  vetoFired: number;             // 0 or 1
  biasAligned: number;           // 1 if macro === technical bias, else 0
  cmeAligned: number;            // 1 if trade direction matches CME gap fill
}

export interface ClassifierPrediction {
  regimeClass: RegimeClass;
  confidence: number;            // 0.0 - 1.0
  positionSizeMultiplier: number;// 0.5 | 1.0 | 1.25
  shapValues?: Record<string, number>; // Feature importance per signal
}

// ---------------------------------------------------------------------------
// WEBSOCKET / PRICE FEED TYPES
// ---------------------------------------------------------------------------

export interface BybitTicker {
  symbol: string;
  lastPrice: number;
  bidPrice: number;
  askPrice: number;
  volume24h: number;
  turnover24h: number;
  highPrice24h: number;
  lowPrice24h: number;
  timestamp: number;
}

export interface PriceUpdate {
  symbol: string;
  price: number;
  timestamp: number;
}

export type AlchemyMode =
  | "TESTNET"
  | "PAPER"
  | "LIVE"
  | "JOURNAL_ONLY"
  | "SAFE_MODE";

export interface AlchemyOutput {
  symbol: string;
  timeframe: string;
  mode: AlchemyMode | string;
  macro_bias: string;
  technical_bias: string;
  session?: string;
  liquidity_state: string;
  setup_type: string;
  confidence: number;
  risk_score: number;
  data_quality: number;
  action_class:
    | "trade_candidate"
    | "watchlist"
    | "no_trade"
    | "reassess"
    | string;
  execution_allowed: boolean;
  journal_required: boolean;
  failed_gate: string | null;
  entry_plan: {
    entry: string;
    stop: string;
    targets: string[];
  };
  conflict_flags: string[];
  notes: string;
}

export type CoordinatorPhase = "perception" | "risk" | "execution" | "journal";

export interface CoordinatorResult {
  ok: boolean;
  phase: CoordinatorPhase | "done" | "failed";
  mode: string;
  final_action: string;
  failed_gate: string | null;
  execution_allowed: boolean;
  perception?: AlchemyOutput;
  risk?: {
    risk_approved?: boolean;
    risk_score?: number;
    forced_mode?: string;
    veto_reason?: string;
    max_position_size?: string;
  };
  execution?: unknown;
  journal?: unknown;
  error?: string;
}